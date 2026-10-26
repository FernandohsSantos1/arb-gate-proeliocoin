import { test, expect } from 'bun:test';
import catalog from '../content/source-catalog.json';
import images from '../content/image-manifest.json';
import { loadSourceArticle } from '../content/source.js';
import { handleSharedContent, publicContentCatalog, resolveSharedRoute } from '../content/routes.js';
import { sourceSnapshot } from './source-snapshot.js';

const responses = new Map(await Promise.all(catalog.articles.map(async (entry) => {
	return [`${entry.source}:${entry.slug}`, await sourceSnapshot(entry).text()];
})));
const requests = new Map(catalog.articles.map((entry) => [entry.source === 'metaoffers'
	? `https://metaoffers.highstakes.tech/api/articles/mejorescreditos.org/${entry.slug}`
	: `https://metacms.highstakes.tech/api/posts/get/${entry.lang}/${entry.slug}/?relateds=0`, entry]));
const browserAgent = 'Mozilla/5.0 Chrome/131.0.0.0 Safari/537.36';
const crawlerAgent = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const context = { waitUntil: () => { throw new Error('O teste sem cache não deve agendar gravação'); } };

function editorialText(html) {
	return html.replace(/<(?:br\b[^>]*|\/(?:p|li|h[1-6]|section|ul|ol|div|blockquote|tr|td|th))\s*>/gi, ' ')
		.replace(/<[^>]*>/g, '').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
			if (/^#x/i.test(entity)) return String.fromCodePoint(parseInt(entity.slice(2), 16));
			if (entity.startsWith('#')) return String.fromCodePoint(Number(entity.slice(1)));
			return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[entity.toLowerCase()];
		})
		.replace(/\b(?:www\.)?(?:guide-?flow\.org|mejorescreditos\.org)\b/gi, 'clickverso.net')
		.replace(/\b(?:Guide[\s-]*Flow|Mejores\s+Cr[eé]ditos)\b/gi, 'ClickVerso')
		.replace(/\s+/g, ' ').trim();
}

function collectEditorialText(value, path, fragments) {
	if (typeof value === 'string') {
		const text = editorialText(value);
		if (text) fragments.push({ path, text });
		return;
	}
	if (value && typeof value === 'object') {
		for (const [key, child] of Object.entries(value)) {
			// O rótulo do botão é uma ação; sem URL válida, ele não pertence ao corpo editorial.
			if (!['fa_icon', 'type', 'style', 'button'].includes(key)) collectEditorialText(child, `${path}.${key}`, fragments);
		}
	}
}

async function fetchSnapshot(url, options) {
	const entry = requests.get(String(url));
	if (!entry) throw new Error(`Requisição fora dos contratos editoriais: ${url}`);
	expect(options.redirect).toBe('manual');
	if (entry.source === 'metacms') {
		expect(options.method).toBe('POST');
		expect(JSON.parse(options.body)).toEqual({ domain: 'guide-flow.org' });
	} else {
		expect(options.method || 'GET').toBe('GET');
		expect(options.body).toBeUndefined();
	}
	return new Response(responses.get(`${entry.source}:${entry.slug}`), { headers: { 'Content-Type': 'application/json' } });
}

async function inspectDocument(html) {
	const result = { title: '', heading: '', lang: null, canonical: null, links: [], script: '', analytics: [], refresh: false, headers: 0, footers: 0, hero: null, socialImage: null, forms: [] };
	const parser = new HTMLRewriter()
		.on('html', { element: (element) => { result.lang = element.getAttribute('lang'); } })
		.on('link[rel="canonical"]', { element: (element) => { result.canonical = element.getAttribute('href'); } })
		.on('a[href]', { element: (element) => { result.links.push(element.getAttribute('href')); } })
		.on('header.site-header', { element: () => { result.headers++; } })
		.on('footer.site-footer', { element: () => { result.footers++; } })
		.on('.shared-hero img', { element: (element) => { result.hero = element.getAttribute('src'); } })
		.on('meta[property="og:image"]', { element: (element) => { result.socialImage = element.getAttribute('content'); } })
		.on('header form', { element: (element) => { result.forms.push([element.getAttribute('action'), element.getAttribute('method')]); } })
		.on('script', { text: (chunk) => { result.script += chunk.text; } })
		.on('head script[data-domain]', { element: element => { result.analytics.push([element.getAttribute('data-domain'), element.getAttribute('src')]); } })
		.on('meta[http-equiv]', { element: (element) => { if (element.getAttribute('http-equiv').toLowerCase() === 'refresh') result.refresh = true; } });
	for (const [selector, key] of [['title', 'title'], ['h1', 'heading']]) parser.on(selector, { text: (chunk) => { result[key] += chunk.text; } });
	await parser.transform(new Response(html)).arrayBuffer();
	for (const key of ['title', 'heading']) result[key] = editorialText(result[key]);
	return result;
}

test.each(catalog.articles.map((entry) => [entry.source, entry.lang, entry.slug, entry]))('%s %s %s: resposta real, idioma e conteúdo estáveis', async (source, language, slug, entry) => {
	const article = await loadSourceArticle(entry, fetchSnapshot);
	expect(article.id).toBe(entry.source_id);
	expect(article.language).toBe(language);
	expect(Array.isArray(article.content)).toBe(source === 'metacms');
	const response = await handleSharedContent(new Request(`https://clickverso.net${entry.canonical_path}`, { headers: { 'User-Agent': browserAgent } }), context, fetchSnapshot, null);
	expect(response.status).toBe(200);
	expect(response.headers.get('Content-Type')).toContain('text/html');
	const html = await response.text();
	const document = await inspectDocument(html);
	expect(document.heading).toBe(editorialText(entry.title));
	expect(document.title).toContain(editorialText(entry.title));
	expect(document.lang).toBe(language);
	expect(document.canonical).toBe(`https://clickverso.net${entry.canonical_path}`);
	expect(document.headers).toBe(1);
	expect(document.footers).toBe(1);
	expect(document.forms).toEqual([['/search/', 'get'], ['/search/', 'get']]);
	for (const path of ['/s/quem-somos/', '/s/contact/', '/s/termos-de-uso/', '/s/politica-de-privacidade/']) expect(document.links).toContain(path);
	const brandedImage = images.images.find((image) => image.source_url === entry.image);
	const imagePath = source === 'metaoffers' ? brandedImage.post_path : new URL(entry.image).pathname;
	expect(document.hero).toBe(source === 'metaoffers' ? imagePath : `https://cdn.clickverso.net/700/350/70${imagePath}`);
	expect(document.socialImage).toBe(source === 'metaoffers' ? `https://clickverso.net${imagePath}` : `https://cdn.clickverso.net/1300/650/70${imagePath}`);
	expect(html).toContain('<script src="/public/js/shared-navigation.js" defer></script>');
	expect(document.analytics).toEqual([['click.clickverso.net', 'https://click.clickverso.net/js/content/clickverso.net.js']]);
	expect(document.script.match(/plausible\.init\(\)/g)).toHaveLength(1);
	expect(html).not.toContain('data-clickverso-analytics');
	const payload = JSON.parse(responses.get(`${source}:${slug}`));
	const rawContent = source === 'metaoffers' ? payload.data.content : JSON.parse(payload.post_data.content);
	const fragments = [];
	collectEditorialText(rawContent, 'content', fragments);
	const visibleText = editorialText(html.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, ''));
	expect(fragments.length).toBeGreaterThan(0);
	expect(fragments.filter((fragment) => !visibleText.includes(fragment.text))).toEqual([]);
	const crawler = await handleSharedContent(new Request(`https://clickverso.net${entry.canonical_path}`, { headers: { 'User-Agent': crawlerAgent } }), context, fetchSnapshot, null);
	expect(crawler.status).toBe(200);
	expect(await crawler.text()).toBe(html);
});

test('Todos os aliases observados preservam idioma e canônico; entradas exigem clique para ler', async () => {
	let aliases = 0;
	for (const entry of catalog.articles) {
		for (const path of entry.source_paths) {
			const response = await handleSharedContent(new Request(`https://clickverso.net${path}`), context, fetchSnapshot, null);
			expect(response.status).toBe(200);
			expect(response.headers.get('Location')).toBeNull();
			const document = await inspectDocument(await response.text());
			expect(document.lang).toBe(entry.lang);
			expect(document.canonical).toBe(`https://clickverso.net${entry.canonical_path}`);
			expect(document.analytics).toEqual([['click.clickverso.net', 'https://click.clickverso.net/js/content/clickverso.net.js']]);
			if (/^\/(r|rb)\//.test(path)) expect(document.links).toContain(`/e/${entry.slug}/`);
			expect(document.refresh).toBe(false);
			expect(document.script).not.toMatch(/(?:window|document)\.location|location\.(?:assign|replace)\s*\(/);
			aliases++;
		}
	}
	expect(aliases).toBe(256);
});

test('As 92 landings seguem a sequência editorial do Guideflow e conservam uma leitura local sem JavaScript', async () => {
	for (const entry of catalog.articles.filter(article => article.source === 'metaoffers')) {
		const record = JSON.parse(responses.get(`metaoffers:${entry.slug}`)).data;
		const response = await handleSharedContent(new Request(`https://clickverso.net/r/${entry.slug}/`), context, fetchSnapshot, null);
		expect(response.status).toBe(200);
		const html = await response.text();
		const document = await inspectDocument(html);
		const ctas = [];
		const reading = [];
		const sequence = [];
		let dates = 0;
		const parser = new HTMLRewriter()
			.on('[data-clickverso-open-modal]', { element: element => { ctas.push(element.getAttribute('href')); } })
			.on('[data-clickverso-read-article]', { element: element => { reading.push(element.getAttribute('href')); } })
			.on('time', { element: () => { dates++; } });
		for (const selector of ['h1', '.shared-landing-intro', '[data-clickverso-open-modal]', '.shared-hero', '.shared-landing-benefits', '.shared-landing-pros', '[data-clickverso-read-article]']) {
			parser.on(selector, { element: () => { sequence.push(selector); } });
		}
		await parser.transform(new Response(html)).arrayBuffer();
		expect(document.lang).toBe(entry.lang);
		expect(document.canonical).toBe(`https://clickverso.net${entry.canonical_path}`);
		expect(ctas).toEqual(Array(3).fill(entry.canonical_path));
		expect(reading).toEqual([entry.canonical_path]);
		expect(dates).toBe(0);
		expect(sequence).toEqual(['h1', '.shared-landing-intro', '[data-clickverso-open-modal]', '.shared-hero', '.shared-landing-benefits', '[data-clickverso-open-modal]', '.shared-landing-pros', '[data-clickverso-open-modal]', '[data-clickverso-read-article]']);
		const text = editorialText(html);
		for (const field of [record.top_text, record.cta_landing, record.content.benefits.intro_paragraph,
			...record.content.benefits.benefits_list.flatMap(item => [item.title, item.description]),
			...record.content.pros_and_cons.pros.flatMap(item => [item.title, item.description])]) {
			expect(text).toContain(editorialText(field));
		}
		for (const item of record.content.pros_and_cons.cons) expect(text).not.toContain(editorialText(item.description));
		expect(html).not.toContain('data-clickverso-read-article data-clickverso-open-modal');
		expect(document.refresh).toBe(false);
	}
});

test('Página desconhecida e threads indisponíveis retornam 404 antes de consultar a origem', async () => {
	let fetched = 0;
	const fetchSource = async () => { fetched++; throw new Error('A origem não deve ser consultada'); };
	for (const path of ['/e/unknown/', ...catalog.threads.flatMap((thread) => thread.source_paths)]) {
		const response = await handleSharedContent(new Request(`https://clickverso.net${path}`), context, fetchSource, null);
		expect(response.status).toBe(404);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
	}
	expect(fetched).toBe(0);
});

test('Catálogo público separa 92 artigos e 107 posts e omite threads indisponíveis', async () => {
	const fetchSource = async () => { throw new Error('Catálogo não consulta a origem'); };
	for (const path of ['/api/clickverso/catalog.json', '/api/guide-flow/catalog.json']) {
		const response = await handleSharedContent(new Request(`https://clickverso.net${path}`), context, fetchSource, null);
		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.articles).toHaveLength(92);
		expect(data.posts).toHaveLength(107);
		expect(data.threads).toEqual([]);
		expect(data.langs).toEqual(['en', 'es', 'fr', 'pt']);
		expect(new Set([...data.articles, ...data.posts].map((entry) => entry.url)).size).toBe(199);
		for (const entry of data.posts) expect(new URL(entry.url).pathname).toMatch(/^\/(en|es|fr|pt)\/p\//);
		for (const entry of data.articles) expect(entry.image).toMatch(/^https:\/\/clickverso\.net\/images\/post\//);
		for (const entry of data.posts) expect(entry.image).toMatch(/^https:\/\/cdn\.clickverso\.net\/700\/350\/70\/guide-flow\.org\//);
	}
});

test('As 92 entradas /r/ correspondem ao catálogo Guideflow e as 21 fontes importadas conservam seus hashes', async () => {
	const snapshot = new URL('./fixtures/content/guideflow-catalog.json', import.meta.url);
	const bytes = await Bun.file(snapshot).bytes();
	expect(new Bun.CryptoHasher('sha256').update(bytes).digest('hex')).toBe(catalog.catalog_import.catalog_sha256);
	const guideflow = JSON.parse(new TextDecoder().decode(bytes));
	const articles = publicContentCatalog().articles;
	expect(articles).toHaveLength(guideflow.articles.length);
	for (const original of guideflow.articles) {
		const article = articles.find(entry => entry.slug === original.slug && entry.lang === original.lang);
		expect(article.title).toBe(original.title);
		expect(article.offer).toBe(original.offer);
		for (const prefix of ['e', 'o', 'i', 'v', 'r', 'ra', 'rb']) {
			const route = resolveSharedRoute(`/${prefix}/${original.slug}/`);
			expect(route.kind).toBe('article');
			expect(route.entry.source_id).toBe(article.article_id);
			expect(route.entry.lang).toBe(original.lang);
		}
	}
	expect(Object.keys(catalog.catalog_import.source_sha256)).toHaveLength(21);
	for (const [slug, hash] of Object.entries(catalog.catalog_import.source_sha256)) {
		const entry = catalog.articles.find(article => article.source === 'metaoffers' && article.slug === slug);
		expect(new Bun.CryptoHasher('sha256').update(await sourceSnapshot(entry).bytes()).digest('hex')).toBe(hash);
	}
});

for (const source of ['metaoffers', 'metacms']) {
	const entry = catalog.articles.find((article) => article.source === source);
	test(`${source}: HTML editorial remove links executáveis e atributos de evento`, async () => {
		const payload = JSON.parse(responses.get(`${source}:${entry.slug}`));
		const injected = '<strong onclick="alert(1)">Texto com destaque</strong> <a href="javascript:alert(1)" onmouseover="alert(1)">Texto JS</a> <a href="java&#x73;cript:alert(1)">Texto JS codificado</a> <a href="data:text/html;base64,PHNjcmlwdD4=">Texto Data</a> <a href="https://example.com/allowed?from=article" onclick="alert(1)">Link permitido</a><img src="invalid" onerror="alert(1)">';
		if (source === 'metaoffers') payload.data.content.introduction.paragraphs.push(injected);
		else {
			const blocks = JSON.parse(payload.post_data.content);
			blocks.push({ type: 'paragraph', data: { text: injected } });
			payload.post_data.content = JSON.stringify(blocks);
		}
		const response = await handleSharedContent(new Request(`https://clickverso.net${entry.canonical_path}`), context, async () => Response.json(payload), null);
		expect(response.status).toBe(200);
		const html = await response.text();
		const document = await inspectDocument(html);
		const eventAttributes = [];
		await new HTMLRewriter().on('*', { element: (element) => {
			for (const [name] of element.attributes) if (/^on/i.test(name)) eventAttributes.push(name);
		} }).transform(new Response(html)).arrayBuffer();
		expect(eventAttributes).toEqual([]);
		for (const href of document.links) expect(['http:', 'https:', 'mailto:']).toContain(new URL(editorialText(href), 'https://clickverso.net').protocol);
		expect(document.links).toContain('https://example.com/allowed?from=article');
		for (const text of ['Texto com destaque', 'Texto JS', 'Texto JS codificado', 'Texto Data', 'Link permitido']) expect(editorialText(html)).toContain(text);
	});
	test(`${source}: falhas de origem e de identidade não viram páginas nem entradas de cache`, async () => {
		const writes = [];
		const cache = { match: async () => null, put: async (...args) => { writes.push(args); } };
		const scenarios = [
			['origem redireciona', null, null, 302, 502],
			['origem 404', null, null, 404, 404], ['origem 500', null, null, 500, 502], ['JSON inválido', null, null, 200, 502],
			['ID incorreto', 'id', 'wrong-id', 200, 502], ['idioma incorreto', source === 'metaoffers' ? 'lang' : 'language', 'de', 200, 502],
			['domínio incorreto', 'domain_name', 'different.example', 200, 502], ['rascunho', 'status', 'draft', 200, 404],
		];
		if (source === 'metaoffers') scenarios.push(['produto incorreto', 'product_id', '999999', 200, 502], ['oferta incorreta', 'offer_id', '999999', 200, 502]);
		for (const [label, field, value, upstreamStatus, expectedStatus] of scenarios) {
			const fetchSource = async () => {
				if (upstreamStatus !== 200) return new Response(null, { status: upstreamStatus });
				if (!field) return new Response('{JSON inválido');
				const payload = JSON.parse(responses.get(`${source}:${entry.slug}`));
				(source === 'metaoffers' ? payload.data : payload.post_data)[field] = value;
				return Response.json(payload);
			};
			const response = await handleSharedContent(new Request(`https://clickverso.net${entry.canonical_path}`), context, fetchSource, cache);
			expect({ label, status: response.status }).toEqual({ label, status: expectedStatus });
			expect(response.headers.get('Cache-Control')).toBe('no-store');
		}
		expect(writes).toHaveLength(0);
	});
	test(`${source}: queries do visitante não chegam à origem nem dividem o cache`, async () => {
		const entries = new Map();
		const keys = [];
		const calls = [];
		const pending = [];
		const cache = { match: async (key) => { keys.push(key.url); return entries.get(key.url)?.clone(); }, put: async (key, response) => { entries.set(key.url, response.clone()); } };
		const ctx = { waitUntil: (promise) => { pending.push(promise); } };
		const fetchSource = async (url, options) => { calls.push({ url, options }); return fetchSnapshot(url, options); };
		const first = await handleSharedContent(new Request(`https://clickverso.net${entry.canonical_path}?mode=dev&url=https%3A%2F%2Fother.example&lang=de&cache=off`), ctx, fetchSource, cache);
		await Promise.all(pending);
		const second = await handleSharedContent(new Request(`https://clickverso.net${entry.canonical_path}?mode=other&url=another&lang=fr&cache=on`), ctx, fetchSource, cache);
		expect(first.status).toBe(200);
		expect(second.status).toBe(200);
		expect(await second.text()).toBe(await first.text());
		expect(calls).toHaveLength(1);
		expect(entries.size).toBe(1);
		expect(keys[0]).toBe(keys[1]);
		for (const name of ['mode', 'url', 'lang', 'cache']) {
			expect(new URL(calls[0].url).searchParams.has(name)).toBe(false);
			expect(new URL(keys[0]).searchParams.has(name)).toBe(false);
		}
	});
}

test('HEAD não retorna corpo em sucesso, catálogo, ausência ou falha da origem', async () => {
	const entry = catalog.articles[0];
	for (const [path, fetchSource, status] of [[entry.canonical_path, fetchSnapshot, 200], ['/api/clickverso/catalog.json', fetchSnapshot, 200], ['/e/unknown/', fetchSnapshot, 404], [entry.canonical_path, async () => new Response(null, { status: 404 }), 404], [entry.canonical_path, async () => new Response(null, { status: 500 }), 502]]) {
		const response = await handleSharedContent(new Request(`https://clickverso.net${path}`, { method: 'HEAD' }), context, fetchSource, null);
		expect(response.status).toBe(status);
		expect(await response.text()).toBe('');
	}
});

test('Timeout da fonte retorna 504 sem cache e respeita HEAD', async () => {
	const writes = [];
	const cache = { match: async () => null, put: async (...args) => { writes.push(args); } };
	const fetchSource = async () => { throw new DOMException('Timeout simulado', 'TimeoutError'); };
	for (const source of ['metaoffers', 'metacms']) {
		const entry = catalog.articles.find((article) => article.source === source);
		for (const method of ['GET', 'HEAD']) {
			const response = await handleSharedContent(new Request(`https://clickverso.net${entry.canonical_path}`, { method }), context, fetchSource, cache);
			expect(response.status).toBe(504);
			expect(response.headers.get('Cache-Control')).toBe('no-store');
			if (method === 'HEAD') expect(await response.text()).toBe('');
		}
	}
	expect(writes).toEqual([]);
});

test('Meta Offers success:false não publica o registro recebido', async () => {
	const entry = catalog.articles.find((article) => article.source === 'metaoffers');
	const payload = JSON.parse(responses.get(`metaoffers:${entry.slug}`));
	payload.success = false;
	const writes = [];
	const cache = { match: async () => null, put: async (...args) => { writes.push(args); } };
	const fetchSource = async () => Response.json(payload);
	await expect(loadSourceArticle(entry, fetchSource)).rejects.toThrow();
	const response = await handleSharedContent(new Request(`https://clickverso.net${entry.canonical_path}`), context, fetchSource, cache);
	expect(response.status).toBe(502);
	expect(response.headers.get('Cache-Control')).toBe('no-store');
	expect(writes).toEqual([]);
});
