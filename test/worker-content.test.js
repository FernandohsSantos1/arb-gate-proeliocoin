// Regressões genéricas com catálogo/identidade herdados. O perfil real do B continua em sites.test.js.
import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test';
import { runInNewContext } from 'node:vm';
import catalog from '../content/source-catalog.json';
import images from '../content/image-manifest.json';
import { sourceSnapshot } from './source-snapshot.js';

const build = await Bun.build({
	entrypoints: [new URL('../index.js', import.meta.url).pathname],
	target: 'browser', format: 'esm', loader: { '.html': 'text' },
	plugins: [{ name: 'inherited-site', setup(builder) {
		builder.onResolve({ filter: /^#site$/ }, () => ({ path: new URL('./fixtures/inherited-site.json', import.meta.url).pathname }));
		builder.onResolve({ filter: /\/source-catalog\.json$/ }, () => ({ path: new URL('./fixtures/inherited-source-catalog.json', import.meta.url).pathname }));
	} }],
});
if (!build.success) throw new AggregateError(build.logs, 'Falha ao compilar o Worker');
const bundlePath = `/tmp/clickverso-worker-test-${crypto.randomUUID()}.mjs`;
await Bun.write(bundlePath, build.outputs[0]);
const worker = (await import(bundlePath)).default;
await Bun.file(bundlePath).delete();

const originalFetch = globalThis.fetch;
const originalCaches = globalThis.caches;
const pending = [];
const calls = [];
const context = { waitUntil: (promise) => { pending.push(promise); } };

function analyticsOptions(html, url, storage) {
	const script = html.match(/<script data-clickverso-analytics[^>]*>([\s\S]*?)<\/script>/)[1];
	const browser = { location: new URL(url), sessionStorage: storage, Date };
	browser.window = browser;
	runInNewContext(script, browser);
	return browser.plausible.o;
}

beforeEach(() => {
	calls.length = 0;
	pending.length = 0;
	globalThis.caches = { default: { match: async () => null, put: async () => {} } };
	globalThis.fetch = async (url, options) => {
		calls.push({ url: String(url), options });
		throw new Error(`Requisição externa inesperada: ${url}`);
	};
});

afterEach(async () => {
	await Promise.all(pending);
	globalThis.fetch = originalFetch;
	globalThis.caches = originalCaches;
});

function useSourceSnapshot(entry) {
	globalThis.fetch = async (url, options) => {
		calls.push({ url: String(url), options });
		const expected = entry.source === 'metaoffers'
			? `https://metaoffers.highstakes.tech/api/articles/mejorescreditos.org/${entry.slug}`
			: `https://metacms.highstakes.tech/api/posts/get/${entry.lang}/${entry.slug}/?relateds=0`;
		expect(String(url)).toBe(expected);
		return new Response(sourceSnapshot(entry));
	};
}

test('Worker preserva /pt/p/ e serve o artigo CMS sem redirect', async () => {
	const entry = catalog.articles.find((article) => article.source === 'metacms' && article.lang === 'pt');
	useSourceSnapshot(entry);
	const response = await worker.fetch(new Request(`https://clickverso.net${entry.canonical_path}?mode=dev`), {}, context);
	expect(response.status).toBe(200);
	expect(response.headers.get('Location')).toBeNull();
	const html = await response.text();
	expect(html).toContain('<html lang="pt">');
	expect(html).toContain(`href="https://clickverso.net${entry.canonical_path}"`);
	expect(html.match(/src="https:\/\/click\.clickverso\.net\/js\/content\/clickverso.net.js"/g)).toHaveLength(1);
	expect(html).toContain('data-clickverso-analytics data-resume="false"');
	expect(JSON.parse(calls[0].options.body)).toEqual({ domain: 'guide-flow.org' });
});

test('Worker mantém o inglês dos caminhos /p/ antigos e seu canônico /en/p/', async () => {
	const entry = catalog.articles.find((article) => article.source === 'metacms' && article.lang === 'en');
	useSourceSnapshot(entry);
	const response = await worker.fetch(new Request(`https://clickverso.net/p/${entry.slug}/`), {}, context);
	expect(response.status).toBe(200);
	const html = await response.text();
	expect(html).toContain('<html lang="en">');
	expect(html).toContain(`href="https://clickverso.net${entry.canonical_path}"`);
});

test('Worker atende artigos e entradas Meta Offers com caminhos compatíveis', async () => {
	const entry = catalog.articles.find((article) => article.source === 'metaoffers');
	useSourceSnapshot(entry);
	for (const prefix of ['e', 'o', 'i', 'v', 'r', 'ra', 'rb']) {
		const response = await worker.fetch(new Request(`https://clickverso.net/${prefix}/${entry.slug}/`), {}, context);
		expect(response.status).toBe(200);
		expect(response.headers.get('Location')).toBeNull();
		const html = await response.text();
		expect(html).toContain(`href="https://clickverso.net/e/${entry.slug}/"`);
		expect(html.match(/data-clickverso-analytics/g)).toHaveLength(1);
		expect(html).toContain('data-clickverso-analytics data-resume="false"');
		expect(html).toContain(entry.title);
	}
});

test('Worker canonicaliza host e barra final sem apagar idioma nem atribuição', async () => {
	const entry = catalog.articles.find((article) => article.source === 'metacms' && article.lang === 'pt');
	const response = await worker.fetch(new Request(`http://www.clickverso.net${entry.canonical_path.slice(0, -1)}?utm_source=teste`), {}, context);
	expect(response.status).toBe(301);
	expect(response.headers.get('Location')).toBe(`https://clickverso.net${entry.canonical_path}?utm_source=teste`);
	expect(calls).toHaveLength(0);
});

test('Worker responde catálogo e erros locais antes dos handlers do CMS antigo', async () => {
	const response = await worker.fetch(new Request('https://clickverso.net/api/clickverso/catalog.json'), {}, context);
	expect(response.status).toBe(200);
	const data = await response.json();
	expect(data.articles).toHaveLength(92);
	expect(data.posts).toHaveLength(107);
	for (const method of ['GET', 'HEAD']) {
		const missing = await worker.fetch(new Request('https://clickverso.net/e/unknown/', { method }), {}, context);
		expect(missing.status).toBe(404);
		expect(missing.headers.get('Location')).toBeNull();
		if (method === 'HEAD') expect(await missing.text()).toBe('');
	}
	const rejected = await worker.fetch(new Request('https://clickverso.net/api/clickverso/catalog.json', { method: 'POST' }), {}, context);
	expect(rejected.status).toBe(405);
	expect(rejected.headers.get('Allow')).toBe('GET, HEAD');
	expect(calls).toHaveLength(0);
});

test('Worker mantém a home nativa e entrega os assets usados pelos artigos', async () => {
	const assetPaths = [];
	const env = {
		ARB_HOME_PAGES: { get: async (key) => { expect(key).toBe('clickverso.net-pt'); return '<h1>Home nativa</h1>'; } },
		ASSETS: { fetch: async (request) => {
			const path = new URL(request.url).pathname;
			assetPaths.push(path);
			return new Response(Bun.file(new URL(`../public${path}`, import.meta.url)));
		} },
	};
	const home = await worker.fetch(new Request('https://clickverso.net/'), env, context);
	expect(home.status).toBe(200);
	expect(await home.text()).toBe('<h1>Home nativa</h1>');
	for (const path of ['/css/index.css', '/css/shared-article.css', '/img/logo.svg', '/js/shared-navigation.js']) {
		const asset = await worker.fetch(new Request(`https://clickverso.net/public${path}`), env, context);
		expect(asset.status).toBe(200);
		expect((await asset.text()).length).toBeGreaterThan(100);
	}
	expect(assetPaths).toEqual(['/css/index.css', '/css/shared-article.css', '/img/logo.svg', '/js/shared-navigation.js']);
	expect(calls).toHaveLength(0);
});

test.each([
	['<svg onload="window.__searchXss=true"></svg>', '&lt;svg onload=&quot;window.__searchXss=true&quot;&gt;&lt;/svg&gt;'],
	['</h1><script>window.__searchXss=true</script>', '&lt;/h1&gt;&lt;script&gt;window.__searchXss=true&lt;/script&gt;'],
	['café & "crédito" <b>pessoal</b>', 'café &amp; &quot;crédito&quot; &lt;b&gt;pessoal&lt;/b&gt;'],
])('busca exibe o termo como texto sem executar HTML: %#', async (term, escaped) => {
	globalThis.fetch = async url => {
		const upstream = new URL(url);
		expect(upstream.pathname).toBe('/api/posts/search/pt/');
		expect(upstream.searchParams.get('q')).toBe(term);
		return Response.json({ posts: [] });
	};
	const url = 'https://clickverso.net/search/?' + new URLSearchParams({ q: term });
	const response = await worker.fetch(new Request(url), {}, context);
	expect(response.status).toBe(200);
	const html = await response.text();
	expect(html).toContain(`<h1>Pesquisa: ${escaped}</h1>`);
	expect(html).not.toContain(term);
});

test.each([[503, 'indisponível'], [200, '{'], [200, '{}']])('home responde 503 sem redirect ou cache quando o CMS falha: %#', async (status, body) => {
	globalThis.fetch = async url => {
		expect(new URL(url).pathname).toBe('/api/home/news-get/pt/');
		return new Response(body, { status, headers: { 'Content-Type': 'application/json' } });
	};
	const env = { ARB_HOME_PAGES: { get: async () => null } };
	const response = await worker.fetch(new Request('https://clickverso.net/'), env, context);
	expect(response.status).toBe(503);
	expect(response.headers.get('Location')).toBeNull();
	expect(response.headers.get('Cache-Control')).toBe('no-store');
	expect(await response.text()).toContain('Conteúdo temporariamente indisponível');
	expect(pending).toHaveLength(0);
	const normalized = await worker.fetch(new Request('https://clickverso.net/pt/'), env, context);
	expect(normalized.status).toBe(302);
	expect(normalized.headers.get('Location')).toBe('https://clickverso.net/');
	const final = await worker.fetch(new Request(normalized.headers.get('Location')), env, context);
	expect(final.status).toBe(503);
	expect(final.headers.get('Location')).toBeNull();
});

test.each(['/pagina-inexistente/', '/s/pagina-inexistente/'])('página inexistente entrega 404 sem redirecionar: %s', async path => {
	globalThis.fetch = async () => Response.json(false);
	const response = await worker.fetch(new Request('https://clickverso.net' + path), {}, context);
	expect(response.status).toBe(404);
	expect(response.headers.get('Location')).toBeNull();
	expect(response.headers.get('Cache-Control')).toBe('no-store');
	expect(await response.text()).toContain('<span class="error-code">404</span>');
	expect(pending).toHaveLength(0);
});

test.each([null, 'seo_image', 'image'])('página estática renderiza com ou sem imagem: %s', async field => {
	globalThis.fetch = async url => {
		expect(new URL(url).pathname).toBe('/api/pages/get/pt/pagina-teste/');
		return Response.json({ page_data: { title: 'Página de teste',
			content: JSON.stringify([{ type: 'paragraph', data: { text: 'Conteúdo da página estática.' } }]),
			...(field ? { [field]: 'https://cms.example.test/clickverso.net/static.png' } : {}),
		}, last_posts: [] });
	};
	const response = await worker.fetch(new Request('https://clickverso.net/s/pagina-teste/'), {}, context);
	expect(response.status).toBe(200);
	expect(response.headers.get('Location')).toBeNull();
	const html = await response.text();
	expect(html).toContain('Conteúdo da página estática.');
	expect(html).toContain(field ? 'https://cdn.clickverso.net/750/450/70/clickverso.net/static.png' : 'https://clickverso.net/public/img/logo.svg');
});

test('Worker entrega as 184 imagens geradas com os hashes registrados e sem consultar a origem', async () => {
	const paths = [];
	const env = { ASSETS: { fetch: async (request) => {
		const path = new URL(request.url).pathname;
		paths.push(path);
		return new Response(Bun.file(new URL(`../public${path}`, import.meta.url)));
	} } };
	expect(images.images).toHaveLength(92);
	for (const image of images.images) {
		for (const type of ['post', 'thumb']) {
			const response = await worker.fetch(new Request(`https://clickverso.net${image[`${type}_path`]}`), env, context);
			expect(response.status).toBe(200);
			expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400');
			expect(response.headers.get('Content-Type')).toStartWith('image/');
			expect(new Bun.CryptoHasher('sha256').update(await response.arrayBuffer()).digest('hex')).toBe(image[type].sha256);
		}
	}
	expect(new Set(paths).size).toBe(184);
	const path = images.images[0].post_path;
	const head = await worker.fetch(new Request(`https://clickverso.net${path}`, { method: 'HEAD' }), env, context);
	expect(head.status).toBe(200);
	expect(await head.text()).toBe('');
	for (const [requestPath, method, status] of [['/images/post/missing.png', 'GET', 404], [path, 'POST', 405]]) {
		const response = await worker.fetch(new Request(`https://clickverso.net${requestPath}`, { method }), env, context);
		expect(response.status).toBe(status);
	}
	expect(calls).toHaveLength(0);
});

test('Worker liga Adspect ao artigo e mantém o cache editorial sem dados da visita', async () => {
	const entry = catalog.articles.find(article => article.source_id === '727' && article.source === 'metaoffers');
	useSourceSnapshot(entry);
	const sourceFetch = globalThis.fetch;
	const rpc = [];
	const cached = [];
	globalThis.caches.default.put = async (_key, response) => { cached.push(response); };
	globalThis.caches.default.match = async () => cached[0]?.clone() || null;
	globalThis.fetch = async (url, options) => {
		if (!String(url).startsWith('https://rpc.adspect.net/')) return sourceFetch(url, options);
		rpc.push(JSON.parse(options.body));
		return Response.json({ cid: 'click_' + rpc.length, ok: false, js: !rpc.at(-1).cid, action: 'noop', target: '' });
	};
	const env = { ADSPECT_STREAM_ID: '00000000-0000-4000-8000-000000000001' };
	const url = `https://clickverso.net/r/${entry.slug}/?gclid=test-click`;
	const first = await worker.fetch(new Request(url, { headers: { 'CF-Connecting-IP': '192.0.2.15' } }), env, context);
	expect(first.headers.get('X-Adspect-Stage')).toBe('fingerprint_pending');
	const cookie = first.headers.get('Set-Cookie').split(';')[0];
	const nonce = cookie.slice('_session_'.length, cookie.indexOf('='));
	const firstHtml = await first.text();
	expect(firstHtml).toContain(entry.title);
	expect(firstHtml).toContain('_adspect_challenge');
	expect(firstHtml).not.toContain('clickverso-redirect-modal');
	expect(firstHtml).not.toContain('data-clickverso-loader');
	expect(firstHtml).not.toContain('location.replace');
	expect(firstHtml).toContain('data-clickverso-analytics data-resume="false"');
	expect(firstHtml.indexOf('data-clickverso-analytics')).toBeLessThan(firstHtml.indexOf('_adspect_challenge'));
	for (const editorial of cached) {
		expect(editorial.headers.get('Set-Cookie')).toBeNull();
		const text = await editorial.clone().text();
		expect(text).not.toContain('_adspect_challenge');
		expect(text).not.toContain('data-clickverso-navigation');
		expect(text).not.toContain('data-clickverso-analytics');
		expect(text).toContain('plausible.init()');
	}
	const second = await worker.fetch(new Request(url, { method: 'POST',
		headers: { 'CF-Connecting-IP': '192.0.2.15', Origin: 'https://clickverso.net', Cookie: cookie },
		body: new URLSearchParams({ data: JSON.stringify({ mode: 'php', errors: {} }), _adspect_challenge: nonce }),
	}), env, context);
	expect(second.headers.get('X-Adspect-Stage')).toBe('complete');
	const secondHtml = await second.text();
	expect(secondHtml).toContain(entry.title);
	expect(secondHtml).not.toContain('clickverso-redirect-modal');
	expect(secondHtml).not.toContain('data-clickverso-loader');
	expect(secondHtml).toContain('href="https://clickverso.net/e/curso-marketing-digital-santander/"');
	expect(secondHtml).not.toContain('_adspect_challenge');
	expect(secondHtml).toContain('data-clickverso-analytics data-resume="true"');
	expect(second.headers.get('Cache-Control')).toBe('private, no-store');
	expect(rpc).toHaveLength(2);
	expect(rpc[1].cid).toBe('click_1');
	expect(cached).toHaveLength(1);
	const values = new Map();
	const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
	const firstOptions = analyticsOptions(firstHtml, url, storage);
	expect(firstOptions.autoCapturePageviews).toBe(true);
	expect(firstOptions.transformRequest({ n: 'pageview' })).toEqual({ n: 'pageview' });
	expect(analyticsOptions(secondHtml, url, storage).autoCapturePageviews).toBe(false);
	expect(analyticsOptions(firstHtml, url, storage).autoCapturePageviews).toBe(true);
	// O GET iniciou o snippet, mas o arquivo defer não executou antes do POST.
	expect(analyticsOptions(secondHtml, url, storage).autoCapturePageviews).toBe(true);
	const blockedStorage = { getItem() { throw new Error('Storage blocked'); }, setItem() { throw new Error('Storage blocked'); } };
	expect(analyticsOptions(firstHtml, url, blockedStorage).autoCapturePageviews).toBe(true);
	expect(analyticsOptions(secondHtml, url, blockedStorage).autoCapturePageviews).toBe(false);
	const pageUrl = new URL(url);
	for (const saved of [
		{ url: pageUrl.pathname + pageUrl.search, at: Date.now() - 60001 },
		{ url: pageUrl.pathname + pageUrl.search, at: Date.now() + 60000 },
		{ url: pageUrl.pathname + '?utm_campaign=outra', at: Date.now() },
	]) {
		values.set('clickverso:pageview', JSON.stringify(saved));
		expect(analyticsOptions(secondHtml, url, storage).autoCapturePageviews).toBe(true);
	}
	analyticsOptions(firstHtml, url, storage).transformRequest({ n: 'custom-event' });
	expect(JSON.parse(values.get('clickverso:pageview')).at).toBe(0);
	const readOnlyStorage = { getItem: () => null, setItem() { throw new Error('Quota exceeded'); } };
	expect(analyticsOptions(firstHtml, url, readOnlyStorage).autoCapturePageviews).toBe(true);
	expect(analyticsOptions(secondHtml, url, readOnlyStorage).autoCapturePageviews).toBe(false);
});

test('Plausible entra em HTML do cache anterior, e HEAD e POST sem stream continuam sem medição', async () => {
	const path = '/r/curso-marketing-digital-santander/';
	globalThis.caches.default.match = async () => new Response('<html><head><title>Artigo</title></head><body>Texto</body></html>', {
		headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=3600' },
	});
	const get = await worker.fetch(new Request('https://clickverso.net' + path), {}, context);
	const html = await get.text();
	expect(html).toContain('data-clickverso-analytics data-resume="false"');
	expect(html.match(/src="https:\/\/click\.clickverso\.net\/js\/content\/clickverso.net.js"/g)).toHaveLength(1);
	const head = await worker.fetch(new Request('https://clickverso.net' + path, { method: 'HEAD' }), {}, context);
	expect(head.status).toBe(200);
	expect(await head.text()).toBe('');
	const post = await worker.fetch(new Request('https://clickverso.net' + path, { method: 'POST' }), {}, context);
	expect(post.status).toBe(405);
	expect(await post.text()).not.toContain('plausible');
	expect(calls).toHaveLength(0);
});

test('Worker não analisa erro de origem e preserva POST na canonicalização', async () => {
	globalThis.fetch = async url => {
		expect(String(url)).not.toContain('rpc.adspect.net');
		return new Response(null, { status: 503 });
	};
	const env = { ADSPECT_STREAM_ID: '00000000-0000-4000-8000-000000000001' };
	const path = '/e/curso-marketing-digital-santander/';
	const response = await worker.fetch(new Request('https://clickverso.net' + path), env, context);
	expect(response.status).toBe(502);
	expect(response.headers.get('X-Adspect-Stage')).toBeNull();
	const canonical = await worker.fetch(new Request('http://www.clickverso.net' + path, { method: 'POST', body: 'data=x' }), env, context);
	expect(canonical.status).toBe(307);
	expect(canonical.headers.get('Location')).toBe('https://clickverso.net' + path);
});
