import { expect, test } from 'bun:test';
import catalog from '../content/source-catalog.json';
import { loadSourceArticle } from '../content/source.js';
import { resolveSharedRoute } from '../content/routes.js';
import { sourceSnapshot } from './source-snapshot.js';

const selectedSources = [
	['pt', '16', '1', 'libre-mesh.org', '751'],
	['pt', '15', '1', 'newssprout.net', '38910'],
	['pt', '7', '1', 'anamma.com.br', '274'],
	['pt', '13', '1', 'agiliza.me', '38698'],
	['en', '29', '6', 'genteymas.net', '39877'],
	['en', '30', '6', 'newssprout.net', '38897'],
	['en', '36', '6', 's2earch.io', '3447'],
	['en', '37', '6', 's2earch.io', '2372'],
	['es', '33', '7', 'libre-mesh.org', '1778'],
	['es', '31', '7', 'agiliza.me', '38681'],
	['es', '35', '7', 's2earch.io', '2862'],
	['es', '34', '7', 'anamma.com.br', '2456'],
];

test('catálogo próprio referencia os 12 registros selecionados, com quatro produtos por idioma', () => {
	expect(catalog.articles.map(entry => [entry.lang, entry.product_id, entry.offer_id, entry.source_domain, entry.source_id])).toEqual(selectedSources);
	expect(new Set(catalog.articles.map(entry => entry.product_id)).size).toBe(12);
	for (const lang of ['pt', 'en', 'es']) expect(catalog.articles.filter(entry => entry.lang === lang)).toHaveLength(4);
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

test('cada rota local mantém a identidade do registro selecionado e não libera o catálogo anterior', () => {
	for (const entry of catalog.articles) {
		for (const path of [entry.canonical_path, `/r/${entry.slug}/`]) {
			expect(resolveSharedRoute(path)).toMatchObject({ kind: 'article', entry });
		}
	}
	expect(resolveSharedRoute('/e/prestamo-personal-bbva/')).toEqual({ kind: 'missing' });
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
