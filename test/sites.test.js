import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import fixture from './fixtures/content/metaoffers-pilot/proeliocoin.com/berkeley-digital-marketing-certificate-program.json';
import { streamSettings, verifyStream } from '../experiments/stream.js';
import { metrics, reportRows, summarize } from '../experiments/report.js';

const projects = [];
for (const id of ['arb-gate-proeliocoin']) {
	const directory = new URL('../', import.meta.url);
	const site = await Bun.file(new URL('site.json', directory)).json();
	const build = await Bun.build({ entrypoints: [new URL('index.js', directory).pathname],
		target: 'browser', format: 'esm', loader: { '.html': 'text' },
		plugins: [{ name: 'site', setup(builder) {
			builder.onResolve({ filter: /^#site$/ }, () => ({ path: new URL('site.json', directory).pathname }));
		} }],
	});
	if (!build.success) throw new AggregateError(build.logs, 'Falha ao compilar ' + id);
	const bundle = `/tmp/${id}-${crypto.randomUUID()}.mjs`;
	await Bun.write(bundle, build.outputs[0]);
	projects.push({ site, worker: (await import(bundle)).default });
	await Bun.file(bundle).delete();
}

const fetchOriginal = globalThis.fetch, cachesOriginal = globalThis.caches;
const calls = [], writes = [], pending = [];
let log, error;
const context = { waitUntil(promise) { pending.push(promise); } };
const env = { ADSPECT_STREAM_ID: '00000000-0000-4000-8000-000000000001', ADSPECT_ROUTING_ENABLED: 'true', EARLY_LOADER_ENABLED: 'true',
	ARB_HOME_PAGES: { async get() { return null; }, async put(key) { writes.push(key); } },
	ASSETS: { async fetch(request) { return new Response('<!DOCTYPE html><html><head></head><body>Money page fixture</body></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }); } } };
const path = `/r/${fixture.data.slug}/`;
const query = '?utm_campaign=ygd_123456789_21&mb=ygd&platform=google&pixel=AW-test%2Flabel&gclid=test&dclid=test-d&gbraid=test-b&wbraid=test-w';

beforeEach(() => {
	calls.length = writes.length = pending.length = 0;
	log = spyOn(console, 'log').mockImplementation(() => {});
	error = spyOn(console, 'error').mockImplementation(() => {});
	globalThis.caches = { default: { async match() { return null; }, async put(key) { writes.push(key.url || key); } } };
	provider(true);
});
afterEach(async () => {
	await Promise.all(pending);
	globalThis.fetch = fetchOriginal; globalThis.caches = cachesOriginal;
	log.mockRestore(); error.mockRestore();
});

function provider(ok, fingerprint = false, unavailable = false) {
	globalThis.fetch = async (url, options) => {
		calls.push({ url: String(url), options });
		if (String(url).startsWith('https://metaoffers.highstakes.tech/')) return Response.json(fixture);
		if (String(url).startsWith('https://metacms.highstakes.tech/api/posts/search/')) return Response.json({ posts: [] });
		if (!String(url).startsWith('https://rpc.adspect.net/')) throw new Error('Serviço inesperado: ' + url);
		if (unavailable) return new Response(null, { status: 503 });
		const input = JSON.parse(options.body);
		return Response.json({ cid: 'test_cid', ok, js: fingerprint && !input.cid, action: 'noop', target: '' });
	};
}

for (const { site, worker } of projects) describe(site.id, () => {
	const origin = `https://${site.domain}`;
	const request = () => new Request(origin + path + query, { headers: { 'CF-Connecting-IP': '192.0.2.42' } });
	test('safe entrega artigo e money entrega money page local, com decisão aplicada', async () => {
			for (const ok of [true, false]) {
				provider(ok);
				const response = await worker.fetch(request(), env, context);
				expect(response.status).toBe(200);
				expect(response.headers.get('Location')).toBeNull();
				expect(response.headers.get('X-Clickverso-Decision')).toBe(ok ? 'money' : 'safe');
				expect(response.headers.get('Cache-Control')).toBe('private, no-store');
				const html = await response.text();
				if (ok) {
					// money: money page local com config injetada
					expect(html).toContain('window.MONEY_PAGE_CONFIG');
					expect(html).toContain('sourceId: "51298"');
					expect(html).toContain('lang: "en"');
				} else {
					// safe: artigo completo com modal
					expect(html).toContain('href="https://proeliocoin.com/e/berkeley-digital-marketing-certificate-program/"');
					expect(html).toContain('platform=google');
					expect(html).toContain('ygd_123456789_21');
				}
				expect(html).not.toContain('click.clickverso.net');
				expect(html).not.toContain('data-clickverso-loader-script');
			}
			const events = log.mock.calls.map(([line]) => JSON.parse(line)).filter(event => event.event === 'adspect_analysis');
			expect(events.map(event => event.ok)).toEqual([true, false]);
			expect(events.every(event => event.site_id === site.id && event.experiment === site.experiment)).toBe(true);
		});
	test('erro do fornecedor mantém o conteúdo local', async () => {
		provider(false, false, true);
		const response = await worker.fetch(request(), env, context);
		expect(response.status).toBe(200);
		expect(response.headers.get('Location')).toBeNull();
		expect(response.headers.get('X-Adspect-Stage')).toBe('provider_http_error');
		expect(await response.text()).toContain(fixture.data.slug);
	});
	test('fingerprint retorna ao mesmo domínio e não decide a navegação', async () => {
		provider(false, true);
		const initial = await worker.fetch(request(), env, context);
		expect(initial.headers.get('X-Adspect-Stage')).toBe('fingerprint_pending');
		const cookie = initial.headers.get('Set-Cookie').split(';')[0];
		const challenge = cookie.match(/^_session_([a-f0-9]+)=/)[1];
		await initial.text();
		const post = new Request(origin + path + query, { method: 'POST', headers: { Origin: origin, Cookie: cookie, 'CF-Connecting-IP': '192.0.2.42' },
			body: new URLSearchParams({ data: '{"mode":"php"}', _adspect_challenge: challenge }) });
		const final = await worker.fetch(post, env, context);
		expect(final.status).toBe(200);
		expect(final.headers.get('X-Adspect-Stage')).toBe('complete');
		expect(final.headers.get('Location')).toBeNull();
		const rpc = calls.filter(call => call.url.startsWith('https://rpc.adspect.net/'));
		expect(rpc).toHaveLength(2);
		expect(JSON.parse(rpc[1].options.body).cid).toBe('test_cid');
		expect(JSON.parse(rpc[1].options.body).server.HTTP_HOST).toBe(site.domain);
	});
	test('catálogo, imagens e cache usam o domínio do projeto', async () => {
		const response = await worker.fetch(new Request(origin + '/api/catalog.json'), env, context);
		const catalog = await response.json();
		expect(catalog.domain).toBe(site.domain);
		expect(catalog.articles).toHaveLength(12);
		expect(catalog.posts).toHaveLength(0);
		for (const article of [...catalog.articles, ...catalog.posts]) expect(new URL(article.url).hostname).toBe(site.domain);
		expect(new URL(catalog.articles[0].image).hostname).toBe(site.domain);
	});
	test('normalização de host permanece no projeto', async () => {
		const response = await worker.fetch(new Request(`http://www.${site.domain}${path}?gclid=test`), env, context);
		expect(response.headers.get('Location')).toBe(origin + path + '?gclid=test');
		expect(calls).toHaveLength(0);
	});
	test('busca usa a origem editorial, escapa HTML e não carrega Plausible de produção', async () => {
		const response = await worker.fetch(new Request(origin + '/search/?q=%3Cb%3Eteste%3C%2Fb%3E'), env, context);
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain('&lt;b&gt;teste&lt;/b&gt;');
		expect(html).toContain(origin + '/search/');
		expect(html).not.toContain('click.clickverso.net');
		expect(JSON.parse(calls[0].options.body).domain).toBe('clickverso.net');
	});
	test('parâmetro duplicado e controle de destino não alteram navegação', async () => {
		const response = await worker.fetch(new Request(origin + path + '?gclid=one&gclid=two&target=https://evil.example', { headers: { 'CF-Connecting-IP': '192.0.2.42' } }), env, context);
		expect(response.status).toBe(200);
		expect(response.headers.get('Location')).toBeNull();
		expect(await response.text()).not.toContain('https://evil.example');
		expect(calls.filter(call => call.url.startsWith('https://rpc.adspect.net/'))).toHaveLength(0);
	});
});

test('perfil próprio preserva fingerprint e os campos de comparação', async () => {
	const site = await Bun.file(new URL('../site.json', import.meta.url)).json();
	expect(site.fingerprint).toBe(true);
	const sites = [{ ...site, fingerprint: false }, site];
	const settings = sites.map(site => streamSettings(site));
	expect(settings.map(value => value.enable_fp)).toEqual([false, true]);
	for (const value of settings) { delete value.name; delete value.tags; delete value.enable_fp; }
	expect(settings[0]).toEqual(settings[1]);
	const expected = streamSettings(sites[0]);
	expect(() => verifyStream(expected, { ...expected, enable_fp: 0 })).not.toThrow();
	expect(() => verifyStream(expected, { ...expected, money_pages: [] })).toThrow();
	expect(() => verifyStream(expected, { ...expected, enable_fp: 'false' })).toThrow();
});

test('relatório mantém incompletos no denominador e não inventa taxas sem tráfego', () => {
	const row = ['100', '60', '30', '70', '20', '10', '10'];
	const result = summarize(reportRows(JSON.stringify(row)));
	expect(result.money_rate).toBe(0.6);
	expect(result.safe_rate).toBe(0.3);
	expect(result.mia_rate).toBe(0.1);
	expect(summarize(reportRows('[]')).money_rate).toBeNull();
	expect(summarize(reportRows(JSON.stringify(row) + '\n' + JSON.stringify(row))).clicks).toBe(200);
	expect(() => summarize([Array(metrics.length).fill(null)])).toThrow();
	expect(() => summarize([[1, 2]])).toThrow();
});
