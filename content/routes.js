import sourceCatalog from './source-catalog.json';
import { loadSourceArticle } from './source.js';
import { renderSharedArticle } from './render.js';
import { articleImageUrl } from './images.js';
import site from '#site';

const CATALOG_PATHS = new Set(['/api/catalog.json', '/api/clickverso/catalog.json', '/api/guide-flow/catalog.json']);
const paths = new Map();
for (const article of sourceCatalog.articles) {
	const aliases = [article.canonical_path, ...article.source_paths];
	if (article.source === 'metaoffers') {
		for (const prefix of ['e', 'o', 'i', 'v', 'r', 'ra', 'rb']) aliases.push(`/${prefix}/${article.slug}/`);
	}
	for (const path of aliases) {
		if (paths.has(path) && paths.get(path) !== article) throw new Error(`Caminho editorial ambíguo: ${path}`);
		paths.set(path, article);
	}
}

export function resolveSharedRoute(pathname) {
	if (CATALOG_PATHS.has(pathname)) return { kind: 'catalog' };
	const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
	const entry = paths.get(path);
	if (entry) return { kind: 'article', entry, format: /^\/(i|v|r|ra|rb)\//.test(path) ? 'landing' : 'article' };
	if (/^\/(e|o|i|v|r|ra|rb|ai)\//.test(path) || /^\/(en|es|fr)\/p\//.test(path)) return { kind: 'missing' };
	return null;
}

export function publicContentCatalog() {
	const articles = sourceCatalog.articles.map(entry => ({
		slug: entry.slug, lang: entry.lang, title: entry.title, image: articleImageUrl(entry), offer: entry.offer,
		article_id: entry.source_id, product_id: entry.product_id, source: entry.source,
		canonical_path: entry.canonical_path, source_paths: entry.source_paths,
		url: `https://${site.domain}${entry.canonical_path}`,
		post_url: `https://${site.domain}${entry.canonical_path}`,
		...(entry.source === 'metaoffers' ? { landing_url: `https://${site.domain}/r/${entry.slug}/` } : {}),
	}));
	return {
		domain: site.domain, alias: 'mejorescreditos.org', schema_version: 1,
		routes: { article: '/e/{slug}/', landing: '/r/{slug}/', post: '/{lang}/p/{slug}/' },
		langs: [...new Set(articles.map(article => article.lang))].sort(),
		offers: [...new Set(articles.map(article => article.offer).filter(Boolean))].sort(),
		articles: articles.filter(article => article.source === 'metaoffers'),
		posts: articles.filter(article => article.source === 'metacms'), threads: [],
		generated_at: sourceCatalog.generated_at,
	};
}

export async function handleSharedContent(request, ctx, fetchSource = fetch, cache = globalThis.caches?.default) {
	const url = new URL(request.url);
	const route = resolveSharedRoute(url.pathname);
	if (!route) return undefined;
	if (!['GET', 'HEAD'].includes(request.method)) {
		return new Response('Método não permitido.', { status: 405, headers: { Allow: 'GET, HEAD' } });
	}
	if (route.kind === 'missing') return contentError(404, request.method);
	if (route.kind === 'catalog') {
		return new Response(request.method === 'HEAD' ? null : JSON.stringify(publicContentCatalog()), {
			headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
		});
	}
	const key = new Request(`${url.origin}${url.pathname}?shared_content=${sourceCatalog.generated_at}&layout=${route.format === 'landing' ? 3 : 2}`);
	const cached = cache ? await cache.match(key) : null;
	if (cached) return request.method === 'HEAD' ? new Response(null, cached) : cached;
	try {
		const article = await loadSourceArticle(route.entry, fetchSource);
		if (!article) return contentError(404, request.method);
		const html = renderSharedArticle(article, route.entry.canonical_path, route.format);
		const response = new Response(html, {
			headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
		});
		if (cache) ctx.waitUntil(cache.put(key, response.clone()));
		return request.method === 'HEAD' ? new Response(null, response) : response;
	} catch (error) {
		console.error('Falha no conteúdo compartilhado:', route.entry.source, route.entry.slug, error.message);
		return contentError(error.name === 'TimeoutError' ? 504 : 502, request.method);
	}
}

function contentError(status, method) {
	const message = status === 404 ? 'Artigo não encontrado.' : 'Conteúdo temporariamente indisponível.';
	return new Response(method === 'HEAD' ? null : message, {
		status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
	});
}
