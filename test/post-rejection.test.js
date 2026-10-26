import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test';
import { prepareVisitPost } from '../visits/index.js';
import site from '#site';

const origin = `https://${site.domain}`, path = '/r/curso-existente/';
const challenge = '0123456789abcdef0123456789abcdef';
const privateValues = ['PRIVATE_QUERY', 'PRIVATE_COOKIE', 'PRIVATE_FINGERPRINT', 'PRIVATE_UA', '192.0.2.250'];
const timeoutOriginal = AbortSignal.timeout.bind(AbortSignal);
let log, timeout;

function post(body, contentType = 'application/x-www-form-urlencoded', requestOrigin = origin, cookie = 'PRIVATE_COOKIE') {
	return new Request(origin + path + '?gclid=PRIVATE_QUERY', { method: 'POST', body,
		headers: { Origin: requestOrigin, 'Content-Type': contentType, 'CF-Connecting-IP': '192.0.2.250',
			'User-Agent': 'PRIVATE_UA', Cookie: `_session_${challenge}=${cookie}` } });
}

function checkRejected(result, status, reason) {
	const response = result.response;
	expect(response.status).toBe(status);
	expect(response.headers.get('X-Clickverso-Reason')).toBe(reason);
	expect(response.headers.get('Cache-Control')).toBe('private, no-store');
	expect(response.headers.get('CDN-Cache-Control')).toBe('no-store');
	expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');
	expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
	expect(response.headers.get('Location')).toBeNull();
	expect(response.headers.get('Set-Cookie')).toBeNull();
	expect(log.mock.calls).toHaveLength(1);
	const serialized = log.mock.calls[0][0];
	expect(JSON.parse(serialized)).toEqual({ source: `${site.id}.visit`, site_id: site.id, revision: site.revision,
		event: 'request_rejected', reason, status, method: 'POST', path });
	for (const value of privateValues) expect(serialized).not.toContain(value);
}

beforeEach(() => { log = spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { timeout?.mockRestore(); timeout = undefined; log.mockRestore(); });

test('403 por origem inválida identifica somente projeto, revisão e motivo', async () => {
	const result = await prepareVisitPost(post('data=PRIVATE_FINGERPRINT', undefined, 'https://other.example'));
	checkRejected(result, 403, 'invalid_origin');
	expect(await result.response.text()).toBe('');
});

test('415 por tipo inválido não registra corpo ou headers do visitante', async () => {
	const result = await prepareVisitPost(post('{"data":"PRIVATE_FINGERPRINT"}', 'application/json'));
	checkRejected(result, 415, 'invalid_content_type');
});

test('400 por formulário inválido não registra dados do fingerprint', async () => {
	const result = await prepareVisitPost(post(new URLSearchParams({ data: 'PRIVATE_FINGERPRINT', _adspect_challenge: challenge })));
	checkRejected(result, 400, 'invalid_fingerprint');
});

test('400 por desafio inválido mantém o motivo sem registrar desafio ou cookie', async () => {
	const result = await prepareVisitPost(post(new URLSearchParams({ data: '{"value":"PRIVATE_FINGERPRINT"}', _adspect_challenge: 'PRIVATE_FINGERPRINT' })));
	checkRejected(result, 400, 'invalid_challenge');
});

test('400 por corpo ausente preserva missing_body', async () => {
	const result = await prepareVisitPost(post(null));
	checkRejected(result, 400, 'missing_body');
});

test('403 por cookie de cid inválido preserva missing_cid', async () => {
	const form = new URLSearchParams({ data: '{"value":"PRIVATE_FINGERPRINT"}', _adspect_challenge: challenge });
	const result = await prepareVisitPost(post(form, undefined, origin, 'PRIVATE_COOKIE.invalid'));
	checkRejected(result, 403, 'missing_cid');
});

test('413 por upload acima de 1 MiB não registra conteúdo recebido', async () => {
	const result = await prepareVisitPost(post('PRIVATE_FINGERPRINT=' + 'x'.repeat(1048577)));
	checkRejected(result, 413, 'body_too_large');
});

test('408 por timeout de upload não registra o corpo parcial', async () => {
	let cancelled = false;
	timeout = spyOn(AbortSignal, 'timeout').mockImplementation(milliseconds => timeoutOriginal(milliseconds === 5000 ? 5 : milliseconds));
	const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('data=PRIVATE_FINGERPRINT')); },
		cancel() { cancelled = true; } });
	const result = await prepareVisitPost(post(body));
	checkRejected(result, 408, 'fingerprint_upload_timeout');
	expect(timeout).toHaveBeenCalledWith(5000);
	expect(cancelled).toBe(true);
});

test('POST inicial válido segue permitido e não gera log de rejeição', async () => {
	const result = await prepareVisitPost(post(new URLSearchParams({ _clickverso_phase: 'analysis' })));
	expect(result).toEqual({ initial: true });
	expect(log).not.toHaveBeenCalled();
});

test('fingerprint válido usa o cookie _session_ sem registrar seus dados', async () => {
	const form = new URLSearchParams({ data: '{"value":"PRIVATE_FINGERPRINT"}', _adspect_challenge: challenge });
	const result = await prepareVisitPost(post(form));
	expect(result).toEqual({ data: { value: 'PRIVATE_FINGERPRINT', cid: 'PRIVATE_COOKIE' }, challenge });
	expect(log).not.toHaveBeenCalled();
});

