import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { prepareVisitPost } from '../visits/index.js';

afterEach(() => mock.restore());


function post(body, headers = {}) {
	return new Request('https://clickverso.net/r/test/', { method: 'POST',
		headers: { Origin: 'https://clickverso.net', 'Content-Type': 'application/x-www-form-urlencoded', ...headers }, body });
}

test('POST inicial pode ser reenviado sem token, relógio ou armazenamento', async () => {
	for (const body of ['_clickverso_phase=analysis', '_clickverso_phase=analysis&_clickverso_visit=old-token']) {
		const results = await Promise.all([prepareVisitPost(post(body)), prepareVisitPost(post(body))]);
		expect(results).toEqual([{ initial: true }, { initial: true }]);
	}
});

test.each([
	['_clickverso_phase=analysis&_clickverso_phase=analysis', 'invalid_fingerprint'],
	['_clickverso_phase=analysis&target=other', 'invalid_fingerprint'],
	['_clickverso_phase=analysis&_clickverso_visit=a&_clickverso_visit=b', 'invalid_fingerprint'],
	['data={}&_adspect_challenge=bad', 'invalid_challenge'],
	['data=null&_adspect_challenge=' + 'a'.repeat(32), 'invalid_fingerprint'],
	['data={}&data={}&_adspect_challenge=' + 'a'.repeat(32), 'invalid_fingerprint'],
])('POST inválido continua recusado: %s', async (body, reason) => {
	spyOn(console, 'log').mockImplementation(() => {});
	const { response } = await prepareVisitPost(post(body));
	expect(response.status).toBe(400);
	expect(response.headers.get('X-Clickverso-Reason')).toBe(reason);
});

test('fingerprint usa o cid do cookie correspondente e aceita reenvio', async () => {
	const challenge = 'a'.repeat(32);
	const body = new URLSearchParams({ data: JSON.stringify({ cid: 'forged', screen: [1280, 720] }), _adspect_challenge: challenge });
	const headers = { Cookie: '_session_' + challenge + '=correct-cid' };
	const first = await prepareVisitPost(post(body, headers));
	expect(first).toEqual({ data: { cid: 'correct-cid', screen: [1280, 720] }, challenge });
	expect(await prepareVisitPost(post(body, headers))).toEqual(first);
});

test('fingerprint sem cookie reinicia análise sem confiar no cid do corpo', async () => {
	const challenge = 'a'.repeat(32);
	const body = new URLSearchParams({ data: '{"cid":"forged"}', _adspect_challenge: challenge });
	expect(await prepareVisitPost(post(body))).toEqual({ initial: true, challenge });
});

test.each([
	[{ Origin: 'https://other.test' }, 403, 'invalid_origin'],
	[{ 'Content-Type': 'application/json' }, 415, 'invalid_content_type'],
])('mantém validação da origem e do tipo do POST: %#', async (headers, status, reason) => {
	spyOn(console, 'log').mockImplementation(() => {});
	const { response } = await prepareVisitPost(post('_clickverso_phase=analysis', headers));
	expect(response.status).toBe(status);
	expect(response.headers.get('X-Clickverso-Reason')).toBe(reason);
	expect(response.headers.get('Cache-Control')).toBe('private, no-store');
});
