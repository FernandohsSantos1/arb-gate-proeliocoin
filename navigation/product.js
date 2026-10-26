import site from '#site';
import { navigationSearch } from './tracking.js';

const NO_STORE = { 'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store',
	'Cloudflare-CDN-Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const UNAVAILABLE = 'Não foi possível abrir o site parceiro. Você pode continuar lendo este artigo e tentar novamente.';

function destinationUrl(value) {
	const target = new URL(value);
	const path = /^\/v\/([a-z0-9-]+)\/$/.exec(target.pathname);
	if (target.protocol !== 'https:' || target.username || target.password || target.port || !path ||
		!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(target.hostname) || target.hostname.replace(/^www\./, '') === site.domain) {
		throw new Error('destination_invalid');
	}
	return target;
}

async function readJson(response, limit) {
	const reader = response.body.getReader(), decoder = new TextDecoder();
	let text = '', bytes = 0;
	try {
		while (true) {
			const chunk = await reader.read();
			if (chunk.done) break;
			bytes += chunk.value.byteLength;
			if (bytes > limit) throw new Error('destination_unverified');
			text += decoder.decode(chunk.value, { stream: true });
		}
	} finally { await reader.cancel(); }
	return JSON.parse(text + decoder.decode());
}

async function productDestination(value, entry, fetchSource, signal) {
	const target = destinationUrl(value), slug = target.pathname.split('/')[2];
	const source = await fetchSource(`https://metaoffers.highstakes.tech/api/articles/${target.hostname}/${slug}`,
		{ redirect: 'manual', signal });
	if (!source.ok) throw new Error('destination_unverified');
	const payload = await readJson(source, 1048576), record = payload.data;
	if (payload.success !== true || !record || record.status !== 'published' || record.domain_name !== target.hostname ||
		record.slug !== slug || record.lang !== entry.lang || String(record.product_id) !== entry.product_id ||
		String(record.offer_id) !== entry.offer_id) throw new Error('product_mismatch');
	target.search = '';
	target.hash = '';
	const page = await fetchSource(target.href, { redirect: 'manual', signal });
	await page.body?.cancel();
	if (page.status !== 200 || !page.headers.get('Content-Type')?.includes('text/html')) throw new Error('destination_unavailable');
	return target;
}

async function firstProduct(values, entry, fetchSource, signal, readDestination) {
	let reason = 'product_mismatch';
	for (let index = 0; index < values.length; index += 4) {
		const candidates = await Promise.allSettled(values.slice(index, index + 4).map(value => readDestination(value, entry, fetchSource, signal)));
		const match = candidates.find(result => result.status === 'fulfilled');
		if (match) return match.value;
		if (signal.aborted) throw new Error('destination_timeout');
		if (candidates.some(result => result.reason.message !== 'product_mismatch')) reason = 'destination_unverified';
	}
	throw new Error(reason);
}

async function productInDomain(domain, entry, fetchSource, signal) {
	const response = await fetchSource(`https://metaoffers.highstakes.tech/api/domains/${domain}/generation-options`,
		{ redirect: 'manual', signal });
	if (!response.ok) throw new Error('destination_unverified');
	const payload = await readJson(response, 1048576), inventory = payload.data;
	if (payload.success !== true || !inventory || inventory.domain !== domain ||
		!Array.isArray(inventory.offers) || inventory.offers.length > 1024) throw new Error('destination_unverified');
	const offers = inventory.offers.filter(offer => offer && String(offer.productId) === entry.product_id && String(offer.offerId) === entry.offer_id);
	if (offers.some(offer => !Array.isArray(offer.articlesFound) || offer.articlesFound.length > 16 ||
		offer.articlesFound.some(slug => typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)))) throw new Error('destination_unverified');
	const slugs = [...new Set(offers.flatMap(offer => offer.articlesFound))];
	if (slugs.length > 16) throw new Error('destination_unverified');
	return firstProduct(slugs.map(slug => `https://${domain}/v/${slug}/`), entry, fetchSource, signal, productDestination);
}

function participatingDomains(pool) {
	if (pool.urls !== undefined && (!Array.isArray(pool.urls) || pool.urls.length > 32 || pool.urls.some(value => typeof value !== 'string'))) {
		throw new Error('pool_invalid');
	}
	if (!Object.hasOwn(pool, 'domains')) {
		const domains = new Set();
		for (const value of pool.urls || []) {
			try { domains.add(destinationUrl(value).hostname); } catch {}
		}
		if (!domains.size) throw new Error('pool_invalid');
		return [...domains];
	}
	if (!Array.isArray(pool.domains) || !pool.domains.length || pool.domains.length > 32) throw new Error('pool_invalid');
	for (const domain of pool.domains) {
		try {
			if (typeof domain !== 'string' || destinationUrl(`https://${domain}/v/verification/`).hostname !== domain) throw new Error();
		} catch { throw new Error('pool_invalid'); }
	}
	return [...new Set(pool.domains)];
}

async function resolveProduct(request, entry, fetchSource) {
	const signal = AbortSignal.timeout(8000), params = new URL(request.url).searchParams;
	const url = new URL('https://aifunnel-server-02.highstakes.tech/api/high-offer/get-data/');
	url.search = new URLSearchParams({ offer_slug: entry.offer, language: entry.lang, source: params.get('utm_source') || 'google' }).toString();
	const cluster = params.get('cl') || params.get('cluster'), country = request.cf?.country || request.headers.get('CF-IPCountry');
	if (cluster) url.searchParams.set('cluster', cluster);
	if (country) url.searchParams.set('country', country);
	const response = await fetchSource(url.href, { redirect: 'manual', signal });
	if (!response.ok) throw new Error('pool_unavailable');
	const pool = await readJson(response, 65536);
	if (!pool || typeof pool !== 'object' || Array.isArray(pool)) throw new Error('pool_invalid');
	const domains = participatingDomains(pool);
	const urls = [...new Set(pool.urls || [])].filter(value => {
		try { return domains.includes(destinationUrl(value).hostname); } catch { return false; }
	});
	try { return await firstProduct(urls, entry, fetchSource, signal, productDestination); }
	catch (error) { if (signal.aborted || error.message === 'destination_timeout') throw error; }
	return firstProduct(domains, entry, fetchSource, signal, productInDomain);
}

export async function redirectSameProduct(request, entry, fetchSource = fetch) {
	let target = null, result = 'matched';
	try {
		target = await resolveProduct(request, entry, fetchSource);
		target.search = navigationSearch(new URL(request.url).search);
	} catch (error) {
		result = /^(pool_(unavailable|invalid)|product_mismatch|destination_(unverified|timeout))$/.test(error.message)
			? error.message : error.name === 'TimeoutError' ? 'destination_timeout' : 'destination_error';
		console.error(JSON.stringify({ event: 'product_destination_error', site_id: site.id, source_id: entry.source_id, reason: result }));
	}
	const json = request.headers.get('Accept')?.includes('application/json');
	const status = target ? json ? 200 : 302 : 503;
	const headers = { ...NO_STORE, 'X-Product-Destination': result };
	console.log(JSON.stringify({ event: 'product_destination', site_id: site.id, source_id: entry.source_id,
		product_id: entry.product_id, lang: entry.lang, result, destination_host: target?.hostname || null, status }));
	if (json) return Response.json(target ? { url: target.href } : { error: UNAVAILABLE }, { status, headers });
	if (target) return new Response(null, { status, headers: { ...headers, Location: target.href } });
	const body = `<!DOCTYPE html><html lang="pt"><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Destino indisponível | ${site.name}</title><h1>Destino indisponível</h1><p>${UNAVAILABLE}</p><a href="${entry.canonical_path}">Ler o artigo</a></html>`;
	return new Response(request.method === 'HEAD' ? null : body, { status, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
}
