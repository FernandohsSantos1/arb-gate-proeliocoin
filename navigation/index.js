import catalog from '../content/source-catalog.json';
import site from '#site';
import { redirectSameProduct } from './product.js';
import { continuationMarkup } from './continuation.js';
import { navigationSearch } from './tracking.js';
export { navigationSearch } from './tracking.js';

const articles = new Map(catalog.articles.map(entry => [`${entry.source}:${entry.source_id}:${entry.lang}`, entry]));
const NO_STORE = { 'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store',
	'Cloudflare-CDN-Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
export const POST_HISTORY_SCRIPT = '<script data-clickverso-history>history.replaceState(history.state,"",location.href);</script>';

export async function handleContentRedirect(request) {
	const url = new URL(request.url);
	if (!url.pathname.startsWith('/go/')) return undefined;
	if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { ...NO_STORE, Allow: 'GET, HEAD' } });
	const match = /^\/go\/(metaoffers)\/(\d+)\/(pt|en|es)\/$/.exec(url.pathname);
	const entry = match && articles.get(`${match[1]}:${match[2]}:${match[3]}`);
	if (!entry) return new Response(null, { status: 404, headers: NO_STORE });
	if (request.method === 'HEAD') return new Response(null, { headers: NO_STORE });
	if (!site.continuation?.[entry.lang]) return new Response(null, { status: 503,
		headers: { ...NO_STORE, 'X-Continuation-State': 'configuration_missing' } });
	return redirectSameProduct(request, entry);
}

export async function attachNavigation(response, request, route, analysis) {
	if ((route.format !== 'landing' && request.method !== 'POST') || request.method === 'HEAD' || response.status !== 200) return response;
	const headers = new Headers(response.headers);
	for (const [key, value] of Object.entries(NO_STORE)) headers.set(key, value);
	let html = await response.text();
	if (route.format === 'landing' && route.entry.source === 'metaoffers') {
		const copy = site.continuation?.[route.entry.lang];
		headers.set('X-Continuation-State', copy ? 'local' : 'configuration_missing');
		if (copy) {
			try {
				const open = !site.observe_only && analysis.stage === 'complete' && analysis.ok === true;
				const markup = continuationMarkup(route.entry, navigationSearch(new URL(request.url).search), copy, open);
				html = html.replace(/<\/body\s*>/i, markup + '</body>');
				headers.set('X-Continuation-State', open ? 'ready' : 'local');
			} catch {
				headers.set('X-Continuation-State', 'configuration_invalid');
				console.error(JSON.stringify({ event: 'continuation_configuration_error', site_id: site.id, lang: route.entry.lang }));
			}
		}
	}
	if (request.method === 'POST') html = html.replace('<head>', '<head>' + POST_HISTORY_SCRIPT);
	headers.delete('Content-Length'); headers.delete('ETag');
	return new Response(html, { status: response.status, headers });
}
