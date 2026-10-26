import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { analyzeAdspect, attachAdspect } from '../adspect/index.js';
import fingerprint from '../adspect/fingerprint.js';

const streamId = '00000000-0000-4000-8000-000000000001';
const origin = 'https://clickverso.example.test';
const articlePath = '/e/artigo-de-teste/';
const ip = '192.0.2.20';
const result = { cid: 'click_1', ok: true, js: false, action: 'noop', target: '' };
const articleHtml = '<!doctype html><html lang="pt"><body><h1>Artigo completo</h1><p>Texto editorial.</p></body></html>';

afterEach(() => mock.restore());

function request(method = 'GET', path = articlePath, body, headers = {}) {
	return new Request(origin + path, { method, body, headers: { 'CF-Connecting-IP': ip, ...headers } });
}

function provider(value = result) {
	return mock(async () => Response.json(value));
}

function articleResponse() {
	return new Response(articleHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8',
		'Cache-Control': 'public, max-age=3600', ETag: 'editorial', 'Content-Length': String(articleHtml.length) } });
}

async function challenge(path = articlePath, cid = 'click_1') {
	return analyzeAdspect(request('GET', path), streamId, provider({ ...result, cid, js: true }));
}

function fingerprintPost(analysis, data = { mode: 'php', errors: {}, screen: [1280, 720] }, path = articlePath, headers = {}) {
	const cookie = analysis.cookie.split(';')[0];
	const nonce = cookie.slice('_session_'.length, cookie.indexOf('='));
	return request('POST', path, new URLSearchParams({ data: JSON.stringify(data), _adspect_challenge: nonce }), {
		Origin: origin, Cookie: cookie, ...headers,
	});
}

test('sem ID e em HEAD não consulta Adspect nem muda a resposta editorial', async () => {
	const fetchProvider = provider();
	for (const [visitor, id, stage] of [[request(), undefined, 'disabled'], [request('HEAD'), streamId, 'skipped']]) {
		const analysis = await analyzeAdspect(visitor, id, fetchProvider);
		const response = articleResponse();
		expect(analysis.stage).toBe(stage);
		expect(await attachAdspect(response, analysis)).toBe(response);
	}
	for (const method of ['PUT', 'DELETE', 'OPTIONS']) expect((await analyzeAdspect(request(method), streamId, fetchProvider)).stage).toBe('skipped');
	expect(fetchProvider).not.toHaveBeenCalled();
});

test('ok true e false preservam exatamente o mesmo artigo sem script ou destino', async () => {
	for (const ok of [true, false]) {
		const analysis = await analyzeAdspect(request(), streamId, provider({ ...result, ok }));
		const response = await attachAdspect(articleResponse(), analysis);
		expect(analysis).toMatchObject({ stage: 'complete', ok, js: false, script: '', cookie: '' });
		expect(await response.text()).toBe(articleHtml);
		expect(response.headers.get('Location')).toBeNull();
		expect(response.headers.get('Set-Cookie')).toBeNull();
		expect(response.headers.get('Cache-Control')).toBe('private, no-store');
	}
});

test('preserva atribuição Google e UTMs no RPC, removendo parâmetros desconhecidos', async () => {
	const query = new URLSearchParams({ utm_source: 'google', utm_campaign: 'Crédito & renda', utm_term: 'conteúdo',
		gclid: 'google-1', wbraid: 'wbraid-1', gbraid: 'gbraid-1', dclid: 'display-1', gclsrc: 'aw.ds',
		gad_source: '1', gad_campaignid: '123', _gl: '1*linker', _ga: 'GA1.2.123', cl: '21', cluster: '21', rb: '1', unknown: 'not-forwarded' });
	const fetchProvider = provider();
	const analysis = await analyzeAdspect(request('GET', articlePath + '?' + query), streamId, fetchProvider);
	expect(analysis.stage).toBe('complete');
	const [url, options] = fetchProvider.mock.calls[0];
	query.delete('unknown');
	expect(url).toBe(`https://rpc.adspect.net/v2/${streamId}?${query}`);
	expect(options.method).toBe('POST');
	expect(options.redirect).toBe('manual');
	expect(options.signal).toBeInstanceOf(AbortSignal);
	expect(JSON.parse(options.body).server).toMatchObject({ QUERY_STRING: query.toString(), REQUEST_URI: articlePath + '?' + query });
});

test('reconstrói servidor sem cookies, autorização, ambiente ou headers de IP forjados', async () => {
	const fetchProvider = provider();
	const visitor = Object.assign(request('GET', articlePath, undefined, {
		'User-Agent': 'Browser Test', 'Accept-Language': 'pt-BR', Cookie: 'private-cookie=value',
		Authorization: 'Bearer private-test', 'Adspect-IP': '198.51.100.1', 'X-Forwarded-For': '198.51.100.2',
		'X-Real-IP': '198.51.100.3', Host: 'forged.example',
	}), { cf: { httpProtocol: 'HTTP/2' } });
	await analyzeAdspect(visitor, streamId, fetchProvider);
	const options = fetchProvider.mock.calls[0][1];
	const headers = new Headers(options.headers);
	expect(headers.get('Adspect-IP')).toBe(ip);
	expect(headers.get('Adspect-UA')).toBe('Browser Test');
	expect(headers.get('User-Agent')).toBe('');
	expect(headers.get('Authorization')).toBeNull();
	expect(headers.get('Content-Type')).toBe('application/x-www-form-urlencoded');
	expect(JSON.parse(options.body)).toEqual({ server: {
		REQUEST_METHOD: 'GET', REQUEST_URI: articlePath, QUERY_STRING: '', HTTP_HOST: 'clickverso.example.test',
		SERVER_NAME: 'clickverso.example.test', SERVER_PORT: '443', SERVER_PROTOCOL: 'HTTP/2', HTTPS: 'on',
		REMOTE_ADDR: ip, HTTP_CF_CONNECTING_IP: ip, HTTP_USER_AGENT: 'Browser Test', HTTP_ACCEPT_LANGUAGE: 'pt-BR',
	} });
});

test.each(['__sid', '__SID', '_', '_cid', 'stream_id', 'action', 'target', 'mode', '_adspect_challenge', 'enable_fp'])('recusa controle interno %s sem retirar artigo', async key => {
	const fetchProvider = provider();
	const analysis = await analyzeAdspect(request('GET', articlePath + '?' + new URLSearchParams({ [key]: 'override' })), streamId, fetchProvider);
	expect(analysis.stage).toBe('invalid_query');
	expect(fetchProvider).not.toHaveBeenCalled();
	expect(await (await attachAdspect(articleResponse(), analysis)).text()).toBe(articleHtml);
});

test.each([
	'utm_source=one&utm_source=two', 'gclid=one&gclid=two', 'cl=other', 'rb=https://example.test',
	'utm_term=%0D%0Anew-header', 'gclid=' + 'a'.repeat(2049),
	'x=' + 'a'.repeat(8192), Array.from({ length: 33 }, (_, i) => `x${i}=1`).join('&'),
])('recusa atribuição inválida: %#', async query => {
	const fetchProvider = provider();
	expect((await analyzeAdspect(request('GET', articlePath + '?' + query), streamId, fetchProvider)).stage).toBe('invalid_query');
	expect(fetchProvider).not.toHaveBeenCalled();
});

test('adapta somente o envio do formulário do coletor inspecionado', async () => {
	expect(new Bun.CryptoHasher('sha256').update(fingerprint).digest('hex')).toBe('8457cdbcb3f8a433807cda004aea4e7a3dc0bba3a1be0f6809fc1bb2c19ddc43');
	expect(fingerprint.split('a.submit()')).toHaveLength(2);
	const analysis = await challenge();
	expect(analysis.stage).toBe('fingerprint_pending');
	const nonce = analysis.cookie.match(/^_session_([a-f0-9]{32})=/)[1];
	const addition = `b=e.createElement("input");b.type="hidden";b.name="_adspect_challenge";b.value="${nonce}";a.appendChild(b);`;
	expect(analysis.script.replace(addition, '')).toBe(fingerprint);
	expect(analysis.cookie).toBe(`_session_${nonce}=click_1; Path=${articlePath}; Max-Age=60; Secure; HttpOnly; SameSite=Lax`);
	expect(analysis.script).not.toContain('click_1');
	expect(analysis.script).not.toContain(streamId);
	expect(() => new Bun.Transpiler({ loader: 'js' }).transformSync(analysis.script.slice(8, -9))).not.toThrow();
});

test('injeta coletor somente na cópia individual depois do cache editorial', async () => {
	const base = articleResponse();
	const cached = base.clone();
	const analysis = await challenge();
	const response = await attachAdspect(base, analysis);
	expect(await response.text()).toBe(articleHtml.replace('</body>', analysis.script + '</body>'));
	expect(await cached.text()).toBe(articleHtml);
	expect(cached.headers.get('Cache-Control')).toBe('public, max-age=3600');
	expect(cached.headers.get('Set-Cookie')).toBeNull();
	expect(response.headers.get('Set-Cookie')).toBe(analysis.cookie);
	expect(response.headers.get('ETag')).toBeNull();
	expect(response.headers.get('Content-Length')).toBeNull();
	expect(response.headers.get('CDN-Cache-Control')).toBe('no-store');
	expect(response.headers.get('Cloudflare-CDN-Cache-Control')).toBe('no-store');
});

test('duas abas do mesmo artigo concluem com seus próprios cids', async () => {
	const first = await challenge(articlePath, 'tab_1');
	const second = await challenge(articlePath, 'tab_2');
	expect(first.cookie.split('=')[0]).not.toBe(second.cookie.split('=')[0]);
	const cookies = `${first.cookie.split(';')[0]}; ${second.cookie.split(';')[0]}`;
	const fetchProvider = provider();
	for (const pending of [second, first]) {
		expect((await analyzeAdspect(fingerprintPost(pending, undefined, articlePath, { Cookie: cookies }), streamId, fetchProvider)).stage).toBe('complete');
	}
	expect(fetchProvider.mock.calls.map(call => JSON.parse(call[1].body).cid)).toEqual(['tab_2', 'tab_1']);
});

test('POST envia o fingerprint, conserva atribuição e substitui cid/servidor forjados', async () => {
	const path = articlePath + '?utm_source=google&gclid=test-click';
	const pending = await challenge(path, 'browser_cid');
	const fetchProvider = provider();
	const analysis = await analyzeAdspect(fingerprintPost(pending, { cid: 'forged', server: { REMOTE_ADDR: 'forged' }, mode: 'php', screen: [1280, 720] }, path), streamId, fetchProvider);
	expect(analysis.stage).toBe('complete');
	const [url, options] = fetchProvider.mock.calls[0];
	expect(url).toEndWith('?utm_source=google&gclid=test-click');
	const body = JSON.parse(options.body);
	expect(body.cid).toBe('browser_cid');
	expect(body.mode).toBe('php');
	expect(body.screen).toEqual([1280, 720]);
	expect(body.server.REMOTE_ADDR).toBe(ip);
	expect(body.server.HTTP_COOKIE).toBeUndefined();
	expect(body._adspect_challenge).toBeUndefined();
	expect(analysis.script).toBe('');
	expect(analysis.cookie).toBe('');
});

test('segunda solicitação de fingerprint encerra o fluxo sem novo coletor ou ciclo', async () => {
	const pending = await challenge();
	const fetchProvider = provider({ ...result, js: true, action: 'redirect', target: 'https://outside.test' });
	const analysis = await analyzeAdspect(fingerprintPost(pending), streamId, fetchProvider);
	expect(analysis).toMatchObject({ stage: 'fingerprint_incomplete', script: '', cookie: '' });
	expect(fetchProvider).toHaveBeenCalledTimes(1);
	expect(await (await attachAdspect(articleResponse(), analysis)).text()).toBe(articleHtml);
});

test('resposta intermediária ignora ação e destino; resposta final não os executa', async () => {
	const remote = { ...result, action: '302', target: 'https://outside.test' };
	const pending = await analyzeAdspect(request(), streamId, provider({ ...remote, js: true }));
	expect(pending.stage).toBe('fingerprint_pending');
	expect(pending.script).not.toContain(remote.target);
	const rejected = await analyzeAdspect(request(), streamId, provider(remote));
	expect(rejected.stage).toBe('unsupported_action');
	expect(await (await attachAdspect(articleResponse(), rejected)).text()).toBe(articleHtml);
});

test.each([
	[{ e: 'echo "unexpected";' }, 'unsupported_php'], [{ e: false }, 'unsupported_php'],
	[{ cid: 'bad;cookie=value' }, 'invalid_response'], [{ cid: 'a'.repeat(129) }, 'invalid_response'],
	[{ ok: 1 }, 'invalid_response'], [{ js: 'true' }, 'invalid_response'], [{ target: null }, 'invalid_response'],
	[{ action: 'php' }, 'unsupported_action'], [{ target: '/another-page' }, 'unsupported_action'],
])('recusa resposta do fornecedor sem alterar artigo: %#', async (fields, stage) => {
	const analysis = await analyzeAdspect(request(), streamId, provider({ ...result, ...fields }));
	expect(analysis).toMatchObject({ stage, script: '', cookie: '' });
	expect(await (await attachAdspect(articleResponse(), analysis)).text()).toBe(articleHtml);
});

test.each([[null], [[]], [{}], ['response']])('recusa estrutura inválida de resposta: %#', async value => {
	expect((await analyzeAdspect(request(), streamId, provider(value))).stage).toBe('invalid_response');
});

test.each([
	[{ Origin: 'https://other.example' }, 'invalid_origin'], [{ Origin: '' }, 'invalid_origin'],
	[{ 'Content-Type': 'application/json' }, 'invalid_content_type'], [{ Cookie: '' }, 'missing_cid'],
])('POST inválido mantém artigo e não chama fornecedor: %#', async (headers, stage) => {
	const pending = await challenge();
	const fetchProvider = provider();
	const analysis = await analyzeAdspect(fingerprintPost(pending, undefined, articlePath, headers), streamId, fetchProvider);
	expect(analysis.stage).toBe(stage);
	expect(fetchProvider).not.toHaveBeenCalled();
	expect(await (await attachAdspect(articleResponse(), analysis)).text()).toBe(articleHtml);
});

test.each([[null], [[]], ['text'], [1]])('recusa JSON de fingerprint não associativo: %#', async data => {
	const pending = await challenge();
	const fetchProvider = provider();
	expect((await analyzeAdspect(fingerprintPost(pending, data), streamId, fetchProvider)).stage).toBe('invalid_fingerprint');
	expect(fetchProvider).not.toHaveBeenCalled();
});

test('recusa campos duplicados, extras e identificador de desafio inválido no POST', async () => {
	const pending = await challenge();
	const valid = fingerprintPost(pending);
	const body = await valid.text();
	for (const changed of [body + '&data={}', body + '&extra=1', body.replace(/_adspect_challenge=[^&]+/, '_adspect_challenge=wrong')]) {
		const fetchProvider = provider();
		const analysis = await analyzeAdspect(request('POST', articlePath, changed, Object.fromEntries(valid.headers)), streamId, fetchProvider);
		expect(['invalid_fingerprint', 'invalid_challenge']).toContain(analysis.stage);
		expect(fetchProvider).not.toHaveBeenCalled();
	}
});

test('não limpa cookies ao receber erro, HTML inexistente ou outro tipo de resposta', async () => {
	const pending = await challenge();
	for (const response of [new Response('ausente', { status: 404 }), Response.json({ articles: [] }), new Response('asset')]) {
		expect(await attachAdspect(response, pending)).toBe(response);
		expect(response.headers.get('Set-Cookie')).toBeNull();
	}
	const invalid = await analyzeAdspect(request('GET', articlePath + '?__sid=wrong'), streamId, provider());
	expect((await attachAdspect(articleResponse(), invalid)).headers.get('Set-Cookie')).toBeNull();
});

test('limita corpo de POST e resposta do fornecedor sem registrar dados pessoais', async () => {
	const log = spyOn(console, 'log').mockImplementation(() => {});
	const error = spyOn(console, 'error').mockImplementation(() => {});
	const pending = await challenge();
	const fetchProvider = provider();
	expect((await analyzeAdspect(fingerprintPost(pending, { large: 'x'.repeat(1024 * 1024) }), streamId, fetchProvider)).stage).toBe('body_too_large');
	expect(fetchProvider).not.toHaveBeenCalled();
	const largeResponse = mock(async () => new Response('x'.repeat(1024 * 1024 + 1)));
	expect((await analyzeAdspect(request(), streamId, largeResponse)).stage).toBe('body_too_large');
	expect(log).not.toHaveBeenCalled();
	expect(error).not.toHaveBeenCalled();
});

test.each(['post', 'response', 'fetch'])('prazo único encerra leitura ou consulta pendente: %s', async stage => {
	const pending = await challenge();
	const signal = new AbortController();
	spyOn(AbortSignal, 'timeout').mockImplementation(milliseconds => { expect(milliseconds).toBe(5000); return signal.signal; });
	const cancel = mock(() => {});
	const stalled = new ReadableStream({ cancel });
	const visitor = stage === 'post' ? request('POST', articlePath, stalled, {
		Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: pending.cookie.split(';')[0],
	}) : request();
	const fetchProvider = stage === 'fetch'
		? mock((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })))
		: mock(async () => new Response(stalled));
	const analysis = analyzeAdspect(visitor, streamId, fetchProvider);
	await Bun.sleep(5);
	signal.abort(new DOMException('Timeout', 'TimeoutError'));
	expect((await analysis).stage).toBe('analysis_timeout');
	if (stage !== 'fetch') expect(cancel).toHaveBeenCalledTimes(1);
});

test.each([302, 401, 500])('não segue redirecionamento nem aceita erro HTTP %i do RPC', async status => {
	const fetchProvider = mock(async () => new Response('private-provider-body', { status, headers: { Location: 'https://outside.test' } }));
	const analysis = await analyzeAdspect(request(), streamId, fetchProvider);
	expect(analysis.stage).toBe('provider_http_error');
	expect(fetchProvider).toHaveBeenCalledTimes(1);
	expect(JSON.stringify(analysis)).not.toContain('private-provider-body');
});

test('erros de transporte e JSON inválido ficam em etapas explícitas', async () => {
	const failed = mock(async () => { throw new Error('private network details'); });
	expect((await analyzeAdspect(request(), streamId, failed)).stage).toBe('provider_unavailable');
	expect((await analyzeAdspect(request(), streamId, mock(async () => new Response('bad json')))).stage).toBe('invalid_response');
	expect((await analyzeAdspect(request(), 'bad-stream', provider())).stage).toBe('missing_configuration');
	expect((await analyzeAdspect(new Request(origin + articlePath), streamId, provider())).stage).toBe('missing_client_ip');
	expect((await analyzeAdspect(request('GET', '/e/slug;path/'), streamId, provider())).stage).toBe('invalid_path');
});
