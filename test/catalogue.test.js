import { expect, test } from 'bun:test';
import catalog from '../content/source-catalog.json';
import { loadSourceArticle } from '../content/source.js';
import { handleSharedContent, publicContentCatalog, resolveSharedRoute } from '../content/routes.js';
import { sourceSnapshot } from './source-snapshot.js';

const selectedSources = [
	['pt', '16', '1', '51301'],
	['pt', '15', '1', '51305'],
	['pt', '7', '1', '51300'],
	['pt', '13', '1', '51303'],
	['en', '29', '6', '51298'],
	['en', '30', '6', '51308'],
	['en', '36', '6', '51314'],
	['en', '37', '6', '51313'],
	['es', '33', '7', '51312'],
	['es', '31', '7', '51315'],
	['es', '35', '7', '51320'],
	['es', '34', '7', '51307'],
];

test('catálogo usa 12 registros do próprio Proeliocoin, com quatro produtos por idioma', () => {
	expect(catalog.articles.map(entry => [entry.lang, entry.product_id, entry.offer_id, entry.source_id])).toEqual(selectedSources);
	for (const entry of catalog.articles) expect(entry.source_domain).toBe('proeliocoin.com');
	expect(new Set(catalog.articles.map(entry => entry.product_id)).size).toBe(12);
	for (const lang of ['pt', 'en', 'es']) expect(catalog.articles.filter(entry => entry.lang === lang)).toHaveLength(4);
	expect(publicContentCatalog()).toMatchObject({ domain: 'proeliocoin.com', alias: 'proeliocoin.com' });
});

test.each(catalog.articles)('lê o conteúdo publicado exato de $source_domain/$slug com rede simulada', async entry => {
	const fixture = await sourceSnapshot(entry).json();
	expect(fixture.data.status).toBe('published');
	const article = await loadSourceArticle(entry, async (url, options) => {
		expect(url).toBe(`https://metaoffers.highstakes.tech/api/articles/${entry.source_domain}/${entry.slug}`);
		expect(options.redirect).toBe('manual');
		return Response.json(fixture);
	});
	expect(article).toMatchObject({ id: entry.source_id, slug: entry.slug, language: entry.lang,
		product_id: entry.product_id, offer_id: entry.offer_id, title: fixture.data.title, image: fixture.data.image });
	expect(article.content).toEqual(fixture.data.content);
});

test.each(catalog.articles)('renderiza $slug com os templates reais do site', async entry => {
	const fixture = await sourceSnapshot(entry).json();
	const context = { waitUntil() { throw new Error('Cache desativado neste teste'); } };
	for (const path of entry.source_paths) {
		for (const method of ['GET', 'HEAD']) {
			const response = await handleSharedContent(new Request(`https://proeliocoin.com${path}`, { method }),
				context, async () => Response.json(fixture), null);
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
			expect(response.headers.get('Location')).toBeNull();
			const html = await response.text();
			if (method === 'HEAD') { expect(html).toBe(''); continue; }
			expect(html).toContain(`<html lang="${entry.lang}">`);
			expect(html).toContain(`<h1>${fixture.data.title}</h1>`);
			expect(html).toContain(`href="https://proeliocoin.com${entry.canonical_path}"`);
			expect(html).toContain('href="https://proeliocoin.com/"');
			expect(html).toMatch(/<footer\b[^>]*class="site-footer"/);
			expect(html).not.toMatch(/{{\s*[^{}]+\s*}}/);
			expect(html).not.toContain('Aqui no Anamma');
		}
	}
});

test('cada rota local mantém a identidade do registro selecionado e não libera o catálogo anterior', () => {
	for (const entry of catalog.articles) {
		for (const path of entry.source_paths) {
			expect(resolveSharedRoute(path)).toMatchObject({ kind: 'article', entry });
		}
	}
	expect(resolveSharedRoute('/e/prestamo-personal-bbva/')).toEqual({ kind: 'missing' });
});

test('URLs anteriores da Alura apontam para o registro próprio do mesmo produto', () => {
	for (const prefix of ['e', 'o', 'i', 'v', 'r', 'ra', 'rb']) {
		const route = resolveSharedRoute(`/${prefix}/curso-de-marketing-digital-alura/`);
		expect(route.entry).toMatchObject({ source_domain: 'proeliocoin.com', source_id: '51300',
			product_id: '7', slug: 'curso-marketing-digital-alura', canonical_path: '/e/curso-marketing-digital-alura/' });
	}
});

test('rejeita troca de domínio, ID, slug, produto, oferta ou idioma do registro', async () => {
	const entry = catalog.articles[0], original = await sourceSnapshot(entry).json();
	for (const change of [{ id: '999' }, { domain_name: 'mejorescreditos.org' }, { slug: 'outro-artigo' },
		{ product_id: '15' }, { offer_id: '6' }, { lang: 'en' }]) {
		const fixture = structuredClone(original);
		Object.assign(fixture.data, change);
		await expect(loadSourceArticle(entry, async () => Response.json(fixture))).rejects.toThrow(/difere do catálogo/);
	}
});
