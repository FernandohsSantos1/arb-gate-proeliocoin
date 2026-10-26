import manifest from './image-manifest.json';
import site from '#site';

const brandedImages = new Map(manifest.images.map((image) => [image.source_url, image]));
const imageAssets = new Map(manifest.images.flatMap((image) => [
	[image.post_path, `/img/money/post/${image.filename}`],
	[image.thumb_path, `/img/money/thumb/${image.filename}`],
]));

export function articleImageUrl(article, social = false) {
	if (article.source === 'metaoffers') {
		const image = brandedImages.get(article.image);
		if (!image) throw new Error(`Imagem Meta Offers sem composição ClickVerso: ${article.slug}. Execute images:sync.`);
		return `https://${site.domain}${image.post_path}`;
	}
	const source = new URL(article.image);
	if (source.origin !== 'https://hide-arb-cms-cdn.highstakes.tech' || !/^\/guide-flow\.org\/[^/]+$/.test(source.pathname)) {
		throw new Error(`Origem de imagem MetaCMS inválida: ${article.slug}.`);
	}
	return `https://${site.cdn_domain}/${social ? '1300/650' : '700/350'}/70${source.pathname}`;
}

export async function handleSharedImage(request, env) {
	const url = new URL(request.url);
	if (!url.pathname.startsWith('/images/')) return undefined;
	if (!['GET', 'HEAD'].includes(request.method)) {
		return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
	}
	const path = imageAssets.get(url.pathname);
	if (!path) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
	const response = await env.ASSETS.fetch(new Request(new URL(path, url), request));
	const headers = new Headers(response.headers);
	headers.set('Cache-Control', response.ok ? 'public, max-age=86400' : 'no-store');
	headers.set('Access-Control-Allow-Origin', '*');
	return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers });
}
