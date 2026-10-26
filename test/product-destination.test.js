import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test';
import { redirectSameProduct } from '../navigation/product.js';
import catalog from '../content/source-catalog.json';
import pool from './fixtures/offer-pool.json';

const entry = catalog.articles.find(article => article.product_id === '13');
const query = '?utm_source=google&cl=21&utm_campaign=ygd_123456789_21&platform=google&pixel=AW-test%2Flabel&gclid=click';
const request = new Request('https://proeliocoin.com/go/metaoffers/38698/pt/' + query);
request.cf = { country: 'BR' };
const destination = pool.urls[0], record = pool.records[destination];
let log, error;
beforeEach(() => {
	log = spyOn(console, 'log').mockImplementation(() => {});
	error = spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { log.mockRestore(); error.mockRestore(); });

for (const article of catalog.articles.filter(article => article.lang === 'pt')) test(`o pool real preserva produto ${article.product_id}, oferta e idioma`, async () => {
	const calls = [];
	const response = await redirectSameProduct(request, article, async (url, options) => {
		calls.push(String(url));
		expect(options.redirect).toBe('manual');
		expect(options.body).toBeUndefined();
		expect(options.headers).toBeUndefined();
		const target = new URL(url);
		if (target.hostname === 'aifunnel-server-02.highstakes.tech') {
			expect(target.searchParams.get('offer_slug')).toBe(article.offer);
			expect(target.searchParams.get('language')).toBe(article.lang);
			expect(target.searchParams.get('cluster')).toBe('21');
			expect(target.searchParams.get('country')).toBe('BR');
			expect(target.searchParams.has('gclid')).toBe(false);
			return Response.json({ urls: pool.urls });
		}
		if (target.hostname === 'metaoffers.highstakes.tech') {
			const [, , , domain, slug] = target.pathname.split('/');
			return Response.json({ success: true, data: pool.records[`https://${domain}/v/${slug}/`] });
		}
		expect(String(pool.records[target.href].product_id)).toBe(article.product_id);
		return new Response('<h1>Curso correspondente</h1>', { headers: { 'Content-Type': 'text/html' } });
	});
	const target = new URL(response.headers.get('Location'));
	const selected = pool.records[target.origin + target.pathname];
	expect(selected.product_id).toBe(article.product_id);
	expect(selected.offer_id).toBe(article.offer_id);
	expect(selected.lang).toBe(article.lang);
	expect(target.search).toBe(query);
	expect(response.status).toBe(302);
	expect(response.headers.get('X-Product-Destination')).toBe('matched');
	expect(response.headers.get('Cache-Control')).toBe('private, no-store');
	expect(calls.some(url => url.includes('guide-flow.org'))).toBe(false);
});

test.each([
	['produto', { product_id: '7' }], ['oferta', { offer_id: '999' }],
	['idioma', { lang: 'es' }], ['domínio', { domain_name: 'other.example' }],
	['slug', { slug: 'other-product' }], ['publicação', { status: 'draft' }],
])('%s diferente falha sem redirecionar para outro produto ou para a home', async (_field, changes) => {
	const response = await redirectSameProduct(request, entry, async url => String(url).includes('/high-offer/')
		? Response.json({ urls: [destination] }) : String(url).includes('/generation-options')
			? Response.json({ success: true, data: { domain: record.domain_name, offers: [] } })
			: Response.json({ success: true, data: { ...record, ...changes } }));
	expect(response.status).toBe(503);
	expect(response.headers.get('Location')).toBeNull();
	expect(response.headers.get('X-Product-Destination')).toBe('product_mismatch');
});

test.each([
	'http://partner.example/v/curso/', 'https://user:pass@partner.example/v/curso/',
	'https://partner.example:8443/v/curso/', 'https://partner.example/r/curso/',
	'https://partner.example/htd/digital-marketing/pt/', 'https://proeliocoin.com/v/curso/',
	'https://www.proeliocoin.com/v/curso/', 'https://127.0.0.1/v/curso/',
])('não consulta nem segue URL inválida do pool: %s', async target => {
	let calls = 0;
	const response = await redirectSameProduct(request, entry, async () => { calls++; return Response.json({ urls: [target] }); });
	expect(calls).toBe(1);
	expect(response.status).toBe(503);
	expect(response.headers.get('Location')).toBeNull();
});

test.each([503, 404, 302])('pool com HTTP %s não provoca navegação', async status => {
	const response = await redirectSameProduct(request, entry, async () => new Response(null, { status }));
	expect(response.headers.get('X-Product-Destination')).toBe('pool_unavailable');
	expect(response.headers.get('Location')).toBeNull();
});

test.each([{}, { urls: [] }, { urls: Array(33).fill(destination) }, { urls: [null] }])('pool inválido não provoca navegação', async payload => {
	const response = await redirectSameProduct(request, entry, async () => Response.json(payload));
	expect(response.headers.get('X-Product-Destination')).toBe('pool_invalid');
	expect(response.status).toBe(503);
});

test('destino que ainda redireciona é descartado; outro domínio do mesmo produto pode responder', async () => {
	const response = await redirectSameProduct(request, entry, async url => {
		if (String(url).includes('/high-offer/')) return Response.json({ urls: pool.urls.slice(0, 2) });
		if (String(url).includes('/api/articles/')) return Response.json({ success: true, data: String(url).includes(record.domain_name) ? record : pool.records[pool.urls[1]] });
		return String(url) === destination ? Response.redirect('https://elsewhere.example/')
			: new Response('', { headers: { 'Content-Type': 'text/html' } });
	});
	expect(response.headers.get('Location')).toBe(pool.urls[1] + query);
});

test('consulta do botão retorna JSON sem redirect HTTP; remove controles de destino da query', async () => {
	const jsonRequest = new Request(request.url + '&target=https://evil.example&gclid=duplicate', { headers: { Accept: 'application/json' } });
	const response = await redirectSameProduct(jsonRequest, entry, async url => String(url).includes('/high-offer/')
		? Response.json({ urls: [destination + '?target=unsafe#fragment'] })
		: String(url).includes('/api/articles/') ? Response.json({ success: true, data: record })
			: new Response('', { headers: { 'Content-Type': 'text/html' } }));
	expect(response.status).toBe(200);
	expect(response.headers.get('Location')).toBeNull();
	const target = new URL((await response.json()).url);
	expect(target.origin + target.pathname).toBe(destination);
	expect(target.searchParams.has('target')).toBe(false);
	expect(target.searchParams.has('gclid')).toBe(false);
	expect(target.hash).toBe('');
});

test('falha na consulta do botão retorna JSON sem URL alternativa', async () => {
	const response = await redirectSameProduct(new Request(request.url, { headers: { Accept: 'application/json' } }), entry,
		async () => { throw new DOMException('Timeout', 'TimeoutError'); });
	expect(response.status).toBe(503);
	expect(response.headers.get('Location')).toBeNull();
	expect(response.headers.get('X-Product-Destination')).toBe('destination_timeout');
	expect(await response.json()).toEqual({ error: expect.any(String) });
});

for (const article of catalog.articles) test(`inventário encontra produto ${article.product_id}/${article.lang} fora da URL escolhida pela categoria`, async () => {
	const fixture = await Bun.file(new URL(`./fixtures/content/metaoffers-pilot/${article.source_domain}/${article.slug}.json`, import.meta.url)).json();
	const calls = [], expected = `https://${article.source_domain}/v/${article.slug}/`;
	const response = await redirectSameProduct(request, article, async (url, options) => {
		const target = new URL(url);
		calls.push(target);
		expect(options.redirect).toBe('manual');
		expect(options.signal).toBeInstanceOf(AbortSignal);
		expect(options.headers).toBeUndefined();
		if (target.pathname.includes('/high-offer/')) return Response.json({ domains: [article.source_domain], urls: ["https://outside-pool.example/v/category-choice/"] });
		if (target.pathname.endsWith('/generation-options')) {
			expect(target.pathname).toBe(`/api/domains/${article.source_domain}/generation-options`);
			return Response.json({ success: true, data: { domain: article.source_domain, offers: [
				{ productId: '999', offerId: article.offer_id, articlesFound: ['unrelated-product'] },
				{ productId: article.product_id, offerId: article.offer_id, articlesFound: [article.slug] },
			] } });
		}
		if (target.pathname.endsWith('/another-course')) return Response.json({ success: true, data: { ...fixture.data, slug: 'another-course', product_id: '999' } });
		if (target.pathname.startsWith('/api/articles/')) return Response.json(fixture);
		expect(target.href).toBe(expected);
		return new Response('<h1>Mesmo curso</h1>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
	});
	expect(response.status).toBe(302);
	expect(response.headers.get('Location')).toBe(expected + query);
	expect(calls.filter(url => url.pathname.endsWith('/generation-options'))).toHaveLength(1);
	expect(calls.some(url => url.pathname.includes('unrelated-product'))).toBe(false);
	expect(calls.every(url => !url.searchParams.has('gclid') && !url.searchParams.has('pixel'))).toBe(true);
	expect(calls.filter(url => url.hostname !== 'metaoffers.highstakes.tech' && url.hostname !== 'aifunnel-server-02.highstakes.tech')
		.every(url => url.hostname === article.source_domain)).toBe(true);
});

test.each([
	{ success: false, data: { domain: record.domain_name, offers: [] } },
	{ success: true, data: { domain: 'outside-pool.example', offers: [] } },
	{ success: true, data: { domain: record.domain_name, offers: null } },
	{ success: true, data: { domain: record.domain_name, offers: Array(1025).fill({}) } },
	{ success: true, data: { domain: record.domain_name, offers: [{ productId: entry.product_id, offerId: entry.offer_id, articlesFound: ['../evil'] }] } },
	{ success: true, data: { domain: record.domain_name, offers: [{ productId: entry.product_id, offerId: entry.offer_id, articlesFound: Array(17).fill(record.slug) }] } },
])('inventário inválido não libera destino', async inventory => {
	const response = await redirectSameProduct(request, entry, async url => String(url).includes('/high-offer/')
		? Response.json({ urls: [destination] }) : String(url).includes('/generation-options')
			? Response.json(inventory) : Response.json({ success: true, data: { ...record, product_id: '999' } }));
	expect(response.status).toBe(503);
	expect(response.headers.get('X-Product-Destination')).toBe('destination_unverified');
	expect(response.headers.get('Location')).toBeNull();
});

test('interrompe corpo editorial acima de 1 MiB sem consultar o destino', async () => {
	let cancelled = false, pages = 0;
	const response = await redirectSameProduct(request, entry, async url => {
		if (String(url).includes('/high-offer/')) return Response.json({ urls: [destination] });
		if (String(url).includes('/generation-options')) return Response.json({ success: true, data: { domain: record.domain_name, offers: [] } });
		if (String(url).includes('/api/articles/')) return new Response(new ReadableStream({
			pull(controller) { controller.enqueue(new Uint8Array(1048577)); },
			cancel() { cancelled = true; },
		}));
		pages++;
		return new Response('');
	});
	expect(response.status).toBe(503);
	expect(cancelled).toBe(true);
	expect(pages).toBe(0);
});

test.each([
	['produto', { product_id: '999' }], ['oferta', { offer_id: '999' }], ['idioma', { lang: 'en' }],
	['publicação', { status: 'draft' }], ['domínio', { domain_name: 'outside-pool.example' }], ['slug', { slug: 'another-course' }],
])('registro do inventário com %s diferente também impede navegação', async (_field, changes) => {
	const response = await redirectSameProduct(request, entry, async url => {
		if (String(url).includes('/high-offer/')) return Response.json({ urls: [`https://${record.domain_name}/v/category-course/`] });
		if (String(url).includes('/generation-options')) return Response.json({ success: true,
			data: { domain: record.domain_name, offers: [{ productId: entry.product_id, offerId: entry.offer_id, articlesFound: [record.slug] }] } });
		return Response.json({ success: true, data: String(url).endsWith('/category-course')
			? { ...record, product_id: '999' } : { ...record, ...changes } });
	});
	expect(response.status).toBe(503);
	expect(response.headers.get('X-Product-Destination')).toBe('product_mismatch');
	expect(response.headers.get('Location')).toBeNull();
});

test.each([[302, 'text/html'], [404, 'text/html'], [503, 'text/html'], [200, 'application/json']])(
	'candidato do inventário com HTTP %s e MIME %s não vira destino', async (status, contentType) => {
		const response = await redirectSameProduct(request, entry, async url => {
			if (String(url).includes('/high-offer/')) return Response.json({ urls: [`https://${record.domain_name}/v/category-course/`] });
			if (String(url).includes('/generation-options')) return Response.json({ success: true,
				data: { domain: record.domain_name, offers: [{ productId: entry.product_id, offerId: entry.offer_id, articlesFound: [record.slug] }] } });
			if (String(url).includes('/api/articles/')) return Response.json({ success: true,
				data: String(url).endsWith('/category-course') ? { ...record, product_id: '999' } : record });
			return new Response('', { status, headers: { 'Content-Type': contentType } });
		});
		expect(response.status).toBe(503);
		expect(response.headers.get('Location')).toBeNull();
	});

test('inventário não usa oferta diferente nem domínio externo fornecido pelo visitante', async () => {
	const calls = [];
	const response = await redirectSameProduct(new Request(request.url + '&domain=outside-pool.example'), entry, async url => {
		calls.push(String(url));
		if (String(url).includes('/high-offer/')) return Response.json({ urls: [destination] });
		if (String(url).includes('/generation-options')) return Response.json({ success: true,
			data: { domain: record.domain_name, offers: [{ productId: entry.product_id, offerId: '999', articlesFound: ['wrong-offer'] }] } });
		return Response.json({ success: true, data: { ...record, product_id: '999' } });
	});
	expect(response.status).toBe(503);
	expect(calls.some(url => url.includes('wrong-offer') || url.includes('outside-pool.example'))).toBe(false);
});

test.each([
	['cl e país da borda', '?utm_source=google&cl=37', 'MX', null, '37', 'MX', 'google'],
	['cluster e header da borda', '?utm_source=google&cluster=54', null, 'CA', '54', 'CA', 'google'],
	['cl tem precedência', '?utm_source=google&cl=42&cluster=54', 'GB', null, '42', 'GB', 'google'],
	['país da borda prevalece sobre query e header', '?country=BR&cluster=45', 'US', 'DE', '45', 'US', 'google'],
	['preserva source recebido', '?utm_source=google_display&cl=48', 'ES', null, '48', 'ES', 'google_display'],
	['ausentes preservam defaults do backend', '?utm_campaign=campaign-test', null, null, null, null, 'google'],
])('contexto do pool: %s', async (_label, search, cfCountry, headerCountry, cluster, country, source) => {
	const input = new Request(`https://proeliocoin.com/go/metaoffers/${entry.source_id}/${entry.lang}/${search}`,
		{ headers: headerCountry ? { 'CF-IPCountry': headerCountry } : {} });
	if (cfCountry) input.cf = { country: cfCountry };
	const response = await redirectSameProduct(input, entry, async url => {
		const target = new URL(url);
		if (target.pathname.includes('/high-offer/')) {
			expect(target.searchParams.get('source')).toBe(source);
			expect(target.searchParams.get('cluster')).toBe(cluster);
			expect(target.searchParams.get('country')).toBe(country);
			expect(target.searchParams.get('offer_slug')).toBe(entry.offer);
			expect(target.searchParams.get('language')).toBe(entry.lang);
			return Response.json({ domains: [record.domain_name], urls: [destination] });
		}
		if (target.pathname.startsWith('/api/articles/')) return Response.json({ success: true, data: record });
		return new Response('', { headers: { 'Content-Type': 'text/html' } });
	});
	expect(response.status).toBe(302);
});

test('lista de domínios sem URLs escolhidas ainda encontra o produto no inventário', async () => {
	const calls = [];
	const response = await redirectSameProduct(request, entry, async url => {
		const target = new URL(url);
		calls.push(target);
		if (target.pathname.includes('/high-offer/')) return Response.json({ domains: [record.domain_name, record.domain_name] });
		if (target.pathname.endsWith('/generation-options')) return Response.json({ success: true,
			data: { domain: record.domain_name, offers: [{ productId: entry.product_id, offerId: entry.offer_id, articlesFound: [record.slug] }] } });
		if (target.pathname.startsWith('/api/articles/')) return Response.json({ success: true, data: record });
		return new Response('', { headers: { 'Content-Type': 'text/html' } });
	});
	expect(response.status).toBe(302);
	expect(response.headers.get('Location')).toBe(destination + query);
	expect(calls.filter(target => target.pathname.endsWith('/generation-options'))).toHaveLength(1);
});

test.each([
	null, {}, [], Array(33).fill(record.domain_name), [null], ['https://partner.example'],
	['partner.example/v/course/'], ['127.0.0.1'], ['proeliocoin.com'], ['www.proeliocoin.com'],
].map(domains => [domains]))('domínios explícitos inválidos não usam as URLs como fallback: %#', async domains => {
	let calls = 0;
	const response = await redirectSameProduct(request, entry, async () => {
		calls++;
		return Response.json({ domains, urls: [destination] });
	});
	expect(calls).toBe(1);
	expect(response.status).toBe(503);
	expect(response.headers.get('X-Product-Destination')).toBe('pool_invalid');
	expect(response.headers.get('Location')).toBeNull();
});

test('candidato fora da lista de domínios não é consultado mesmo quando corresponde ao produto', async () => {
	const calls = [], outside = 'outside-pool.example';
	const response = await redirectSameProduct(request, entry, async url => {
		const target = new URL(url);
		calls.push(target);
		if (target.pathname.includes('/high-offer/')) return Response.json({ domains: [record.domain_name],
			urls: [`https://${outside}/v/${record.slug}/`] });
		if (target.pathname.endsWith('/generation-options')) return Response.json({ success: true,
			data: { domain: record.domain_name, offers: [{ productId: entry.product_id, offerId: entry.offer_id, articlesFound: [record.slug] }] } });
		if (target.pathname.startsWith('/api/articles/')) return Response.json({ success: true, data: record });
		return new Response('', { headers: { 'Content-Type': 'text/html' } });
	});
	expect(response.status).toBe(302);
	expect(response.headers.get('Location')).toBe(destination + query);
	expect(calls.some(target => target.hostname === outside || target.pathname.includes(outside))).toBe(false);
});
