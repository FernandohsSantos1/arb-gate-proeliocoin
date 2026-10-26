import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test';
import catalog from '../content/source-catalog.json';
import { sourceSnapshot } from './source-snapshot.js';
import { continuationWorker, fixtureCopy, fixtureSite } from './continuation-harness.js';

const worker = await continuationWorker();
const unconfigured = await continuationWorker({ ...fixtureSite, continuation: undefined });
const passive = await continuationWorker({ ...fixtureSite, observe_only: true });
const entry = catalog.articles.find(article => article.product_id === '13');
const fixture = await sourceSnapshot(entry).json(), origin = `https://${fixtureSite.domain}`;
const landing = `/r/${entry.slug}/`, query = '?utm_source=google&cl=47&gclid=synthetic-click&pixel=AW-123/synthetic-label&placement=publisher.example';
const endpoint = `/go/metaoffers/${entry.source_id}/${entry.lang}/`, partner = 'partner.example';
const destination = `https://${partner}/v/${entry.slug}/`;
const headers = { 'CF-Connecting-IP': '192.0.2.27', 'User-Agent': 'B27 fixture', Accept: 'text/html' };
const fetchOriginal = globalThis.fetch, cachesOriginal = globalThis.caches;
const calls = [], pending = [], cache = new Map();
const context = { waitUntil(promise) { pending.push(promise); } };
const env = { ADSPECT_STREAM_ID: '00000000-0000-4000-8000-000000000027',
	ADSPECT_ROUTING_ENABLED: 'true', EARLY_LOADER_ENABLED: 'true',
	ASSETS: { async fetch() { return new Response('<!DOCTYPE html><html><head></head><body><article><h1>Artigo da fixture</h1><p>Conteúdo do artigo.</p></article></body></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }); } } };
let ok, fingerprint, result, log, error;

async function upstream(value, options) {
	const url = new URL(value);
	calls.push({ url, options });
	if (url.hostname === 'rpc.adspect.net') {
		const body = JSON.parse(options.body);
		return Response.json(result || { cid: 'fixture_cid', ok, js: fingerprint && !body.cid, action: 'noop', target: '' });
	}
	if (url.href === `https://metaoffers.highstakes.tech/api/articles/${entry.source_domain}/${entry.slug}`) return Response.json(fixture);
	if (url.href === `https://metaoffers.highstakes.tech/api/articles/${partner}/${entry.slug}`) return Response.json({ success: true,
		data: { ...fixture.data, domain_name: partner } });
	if (url.pathname === '/api/high-offer/get-data/') return Response.json({ domains: [partner] });
	if (url.pathname === `/api/domains/${partner}/generation-options`) return Response.json({ success: true,
		data: { domain: partner, offers: [{ productId: entry.product_id, offerId: entry.offer_id, articlesFound: [entry.slug] }] } });
	if (url.href === destination) return new Response('<h1>Destino da fixture</h1>', { headers: { 'Content-Type': 'text/html' } });
	throw new Error('Rede fora da fixture B27: ' + url.href);
}

beforeEach(() => {
	calls.length = pending.length = 0; cache.clear();
	ok = true; fingerprint = false; result = null;
	globalThis.fetch = upstream;
	globalThis.caches = { default: { async match(request) { return cache.get(request.url)?.clone(); },
		async put(request, response) { cache.set(request.url, response.clone()); } } };
	log = spyOn(console, 'log').mockImplementation(() => {}); error = spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => {
	await Promise.all(pending);
	globalThis.fetch = fetchOriginal; globalThis.caches = cachesOriginal;
	log.mockRestore(); error.mockRestore();
});

function poolCalls() { return calls.filter(call => call.url.pathname === '/api/high-offer/get-data/'); }

function post(cookie, challenge) {
	return new Request(origin + landing + query, { method: 'POST', headers: { ...headers, Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
		body: new URLSearchParams({ data: '{"cid":"forged","mode":"php","screen":[1280,720]}', _adspect_challenge: challenge }) });
}

test('fixture liberada entrega artigo completo e dialog próprio, sem consulta de destino ou navegação', async () => {
	const response = await worker.fetch(new Request(origin + landing + query, { headers }), env, context);
	const html = await response.text();
	expect(response.status).toBe(200); expect(response.headers.get('Location')).toBeNull();
	expect(response.headers.get('X-Continuation-State')).toBe('ready');
	expect(html).toContain(fixture.data.title); expect(html).toContain(fixture.data.product_official_url);
	expect(html).toContain('<dialog '); expect(html).toContain(fixtureCopy.title);
	expect(html).toContain(`data-endpoint="${endpoint}${query.replaceAll('&', '&amp;')}"`);
	expect(html).toContain('/public/js/continuation-navigation.js');
	expect(html).not.toMatch(/rewarded|wrapper\.highleverage|data-clickverso-loader|guide-flow\.org\/htd/i);
	expect(poolCalls()).toHaveLength(0);
});

test('negação mantém o mesmo artigo e a oferta acessível sem abrir dialog', async () => {
	ok = false;
	const response = await worker.fetch(new Request(origin + landing + query, { headers }), env, context);
	const html = await response.text();
	expect(response.status).toBe(200); expect(response.headers.get('Location')).toBeNull();
	expect(response.headers.get('X-Clickverso-Decision')).toBe('safe');
	expect(html).toContain(fixture.data.title); expect(html).toContain(fixture.data.product_official_url);
	expect(html).toContain(`href="${endpoint}${query.replaceAll('&', '&amp;')}"`);
	expect(html).not.toContain('<dialog'); expect(poolCalls()).toHaveLength(0);
});

test('GET seguido de fingerprint POST retorna localmente e só depois insere dialog', async () => {
	fingerprint = true;
	const initial = await worker.fetch(new Request(origin + landing + query, { headers }), env, context);
	const cookie = initial.headers.get('Set-Cookie').split(';')[0], challenge = cookie.match(/^_session_([a-f0-9]+)=/)[1];
	expect(initial.headers.get('Set-Cookie')).toContain('Max-Age=60');
	expect(initial.headers.get('X-Adspect-Stage')).toBe('fingerprint_pending');
	expect(await initial.text()).not.toContain('<dialog');
	const final = await worker.fetch(post(cookie, challenge), env, context);
	expect(final.status).toBe(200); expect(final.headers.get('Location')).toBeNull();
	expect(final.headers.get('X-Adspect-Stage')).toBe('complete');
	expect(final.headers.get('Set-Cookie')).toBeNull(); expect(await final.text()).toContain('<dialog');
	expect(poolCalls()).toHaveLength(0);
	const rpc = calls.filter(call => call.url.hostname === 'rpc.adspect.net');
	expect(rpc).toHaveLength(2); expect(JSON.parse(rpc[1].options.body).cid).toBe('fixture_cid');
});

test('POST sem cookie pode iniciar análise nova sem repetir coletor em ciclo', async () => {
	fingerprint = true;
	const initial = await worker.fetch(new Request(origin + landing, { headers }), env, context);
	const cookie = initial.headers.get('Set-Cookie').split(';')[0], challenge = cookie.match(/^_session_([a-f0-9]+)=/)[1];
	await initial.text();
	const response = await worker.fetch(post('', challenge), env, context);
	expect(response.headers.get('X-Adspect-Stage')).toBe('fingerprint_incomplete');
	expect(response.headers.get('Location')).toBeNull(); expect(response.headers.get('Set-Cookie')).toBeNull();
	expect(await response.text()).not.toMatch(/<dialog|_adspect_challenge/); expect(poolCalls()).toHaveLength(0);
});

test('cada reenvio de fingerprint consulta Adspect sem estado persistente', async () => {
	fingerprint = true;
	const initial = await worker.fetch(new Request(origin + landing, { headers }), env, context);
	const cookie = initial.headers.get('Set-Cookie').split(';')[0], challenge = cookie.match(/^_session_([a-f0-9]+)=/)[1];
	await initial.text();
	for (let count = 0; count < 2; count++) {
		const response = await worker.fetch(post(cookie, challenge), env, context);
		expect(response.status).toBe(200); expect(response.headers.get('Location')).toBeNull(); await response.text();
	}
	expect(calls.filter(call => call.url.hostname === 'rpc.adspect.net')).toHaveLength(3);
	expect(poolCalls()).toHaveLength(0);
});

test('dois reenvios simultâneos são análises independentes e permanecem no artigo', async () => {
	fingerprint = true;
	const initial = await worker.fetch(new Request(origin + landing, { headers }), env, context);
	const cookie = initial.headers.get('Set-Cookie').split(';')[0], challenge = cookie.match(/^_session_([a-f0-9]+)=/)[1];
	await initial.text();
	const responses = await Promise.all([worker.fetch(post(cookie, challenge), env, context), worker.fetch(post(cookie, challenge), env, context)]);
	for (const response of responses) {
		expect(response.status).toBe(200); expect(response.headers.get('Location')).toBeNull();
		expect(await response.text()).toContain('<dialog');
	}
	expect(calls.filter(call => call.url.hostname === 'rpc.adspect.net')).toHaveLength(3);
	expect(poolCalls()).toHaveLength(0);
});

test('duas abas mantêm desafios de fingerprint independentes sem diário', async () => {
	fingerprint = true;
	const cookies = [];
	for (let count = 0; count < 2; count++) {
		const response = await worker.fetch(new Request(origin + landing, { headers }), env, context);
		cookies.push(response.headers.get('Set-Cookie').split(';')[0]); await response.text();
	}
	expect(cookies[0].split('=')[0]).not.toBe(cookies[1].split('=')[0]);
	for (const cookie of cookies) {
		const challenge = cookie.match(/^_session_([a-f0-9]+)=/)[1];
		const response = await worker.fetch(post(cookies.join('; '), challenge), env, context);
		expect(response.status).toBe(200); expect(response.headers.get('Location')).toBeNull();
		expect(await response.text()).toContain('<dialog');
	}
	expect(calls.filter(call => call.url.hostname === 'rpc.adspect.net')).toHaveLength(4);
	expect(poolCalls()).toHaveLength(0);
});

test('indisponibilidade do fornecedor fica distinta de negação e não abre continuação', async () => {
	globalThis.fetch = (value, options) => new URL(value).hostname === 'rpc.adspect.net'
		? Promise.reject(new Error('Falha simulada')) : upstream(value, options);
	const response = await worker.fetch(new Request(origin + landing, { headers }), env, context);
	expect(response.headers.get('X-Adspect-Stage')).toBe('provider_unavailable');
	expect(response.headers.get('X-Clickverso-Decision')).toBe('unavailable');
	expect(response.headers.get('Location')).toBeNull(); expect(await response.text()).not.toContain('<dialog');
	expect(poolCalls()).toHaveLength(0);
});

test('o clique consulta /go e recebe apenas a URL validada do mesmo produto', async () => {
	const request = new Request(origin + endpoint + query, { headers: { ...headers, Accept: 'application/json', 'CF-IPCountry': 'MX', Cookie: 'private=not-forwarded' } });
	const response = await worker.fetch(request, env, context);
	expect(response.status).toBe(200); expect(response.headers.get('Location')).toBeNull();
	expect(await response.json()).toEqual({ url: destination + query });
	expect(poolCalls()).toHaveLength(1); expect(poolCalls()[0].url.searchParams.get('cluster')).toBe('47');
	expect(poolCalls()[0].url.searchParams.get('country')).toBe('MX');
	expect(calls.some(call => call.url.hostname === 'rpc.adspect.net')).toBe(false);
	for (const call of calls) { expect(call.options.headers).toBeUndefined(); expect(call.options.body).toBeUndefined(); expect(call.url.href).not.toContain('not-forwarded'); }
});

test('clique sem JavaScript pode seguir HTTP somente após validação do produto', async () => {
	const response = await worker.fetch(new Request(origin + endpoint + query, { headers }), env, context);
	expect(response.status).toBe(302); expect(response.headers.get('Location')).toBe(destination + query);
});

test.each([landing, endpoint])('HEAD em %s não analisa, consulta pool ou navega', async path => {
	const response = await worker.fetch(new Request(origin + path, { method: 'HEAD' }), env, context);
	expect(response.status).toBe(200); expect(response.headers.get('Location')).toBeNull(); expect(await response.text()).toBe('');
	expect(calls.some(call => call.url.hostname === 'rpc.adspect.net')).toBe(false); expect(poolCalls()).toHaveLength(0);
});

test('perfil de observação da fixture não abre dialog mesmo quando configurado', async () => {
	const response = await passive.fetch(new Request(origin + landing, { headers }), env, context);
	expect(response.headers.get('X-Clickverso-Decision')).toBe('observe'); expect(await response.text()).not.toContain('<dialog');
	expect(poolCalls()).toHaveLength(0);
});

test('sem configuração explícita a fixture mantém artigo e /go informa pendência', async () => {
	const response = await unconfigured.fetch(new Request(origin + landing, { headers }), env, context);
	const html = await response.text();
	expect(html).toContain(fixture.data.title); expect(html).not.toContain('<dialog');
	expect(response.headers.get('X-Continuation-State')).toBe('configuration_missing');
	const selected = await unconfigured.fetch(new Request(origin + endpoint, { headers }), env, context);
	expect(selected.status).toBe(503); expect(selected.headers.get('Location')).toBeNull(); expect(poolCalls()).toHaveLength(0);
});

test.each(['local', 'redirect', 'html', 'php'])('ação não suportada %s não injeta modal nem executa código', async action => {
	result = { cid: 'fixture_cid', ok: true, js: false, action, target: '' };
	const response = await worker.fetch(new Request(origin + landing, { headers }), env, context);
	expect(response.headers.get('X-Adspect-Stage')).toBe('unsupported_action'); expect(response.headers.get('Location')).toBeNull();
	expect(await response.text()).not.toContain('<dialog'); expect(poolCalls()).toHaveLength(0);
});

test('PHP retornado pelo fornecedor permanece sem execução', async () => {
	result = { cid: 'fixture_cid', ok: true, js: false, action: 'noop', target: '', e: 'EXECUTAR_PHP_DA_FIXTURE' };
	const response = await worker.fetch(new Request(origin + landing, { headers }), env, context);
	expect(response.headers.get('X-Adspect-Stage')).toBe('unsupported_php');
	expect(await response.text()).not.toMatch(/<dialog|EXECUTAR_PHP_DA_FIXTURE/); expect(poolCalls()).toHaveLength(0);
});

test('cache editorial não contém modal, cookie, fingerprint ou classificação', async () => {
	const response = await worker.fetch(new Request(origin + landing + query, { headers }), env, context);
	await response.text(); await Promise.all(pending);
	for (const cached of cache.values()) {
		expect(cached.headers.get('Set-Cookie')).toBeNull();
		expect(await cached.clone().text()).not.toMatch(/<dialog|_adspect_challenge|synthetic-click/);
	}
	ok = false;
	const denied = await worker.fetch(new Request(origin + landing + query, { headers }), env, context);
	expect(await denied.text()).not.toContain('<dialog');
	expect(calls.filter(call => call.url.hostname === 'rpc.adspect.net')).toHaveLength(2);
});

test('POST inválido não recupera por redirect nem consulta serviços externos', async () => {
	const response = await worker.fetch(new Request(origin + landing, { method: 'POST', headers: { Origin: 'https://outside.example' }, body: 'data={}' }), env, context);
	expect(response.status).toBe(403); expect(response.headers.get('Location')).toBeNull(); expect(calls).toHaveLength(0);
});
