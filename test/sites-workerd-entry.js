import worker from '@site-worker';
import site from '#site';
import fixture from './fixtures/content/metaoffers-pilot/genteymas.net/berkeley-digital-mkt-certificate.json';

let rpcCount = 0, poolCount = 0, destinationCount = 0;
const check = (value, message) => { if (!value) throw new Error(message); };
const origin = `https://${site.domain}`, slug = fixture.data.slug;
const destination = `https://partner.example/v/${slug}/`;
const baseQuery = '?utm_source=google&cl=47&campaignid=9007199254740993&placement=publisher.example&network=d&gclid=runtime-click&pixel=AW-123/runtime-label';
export const cache = { async fetch(request) { await request.arrayBuffer(); return new Response(null, { status: request.method === 'GET' ? 504 : 200 }); } };

export const upstream = { async fetch(request) {
	const url = new URL(request.url);
	if (url.hostname === 'rpc.adspect.net') {
		rpcCount++;
		const body = await request.json();
		check(body.server.HTTP_HOST === site.domain, 'Domínio incorreto no RPC');
		check(new URLSearchParams(body.server.QUERY_STRING).get('placement') === 'publisher.example', 'RPC perdeu placement');
		if (body.cid) check(body.cid === 'runtime_cid', 'Fingerprint perdeu o cid do cookie');
		return Response.json({ cid: 'runtime_cid', ok: url.searchParams.get('utm_content') === 'money',
			js: !body.cid, action: 'noop', target: '' });
	}
	check(!request.headers.has('Cookie') && !request.headers.has('Authorization'), 'Consulta editorial ou pool recebeu dados privados');
	if (url.hostname === 'aifunnel-server-02.highstakes.tech') {
		poolCount++;
		check(url.searchParams.get('language') === 'en' && url.searchParams.get('cluster') === '47' && url.searchParams.get('country') === 'MX', 'Pool perdeu contexto recebido');
		check(!url.searchParams.has('gclid') && !url.searchParams.has('pixel'), 'Pool recebeu identificadores da visita');
		return Response.json({ domains: ['partner.example'] });
	}
	if (url.hostname === 'metaoffers.highstakes.tech') return editorialResponse(url);
	check(request.url === destination && request.redirect === 'manual', 'Destino inesperado ou redirect automático na validação');
	destinationCount++;
	return new Response('<h1>Berkeley: destino estático da fixture</h1>', { headers: { 'Content-Type': 'text/html' } });
} };

function editorialResponse(url) {
	if (url.pathname === '/api/domains/partner.example/generation-options') return Response.json({ success: true,
		data: { domain: 'partner.example', offers: [{ productId: fixture.data.product_id, offerId: fixture.data.offer_id, articlesFound: [slug] }] } });
	if (url.pathname === `/api/articles/partner.example/${slug}`) return Response.json({ success: true,
		data: { ...fixture.data, domain_name: 'partner.example' } });
	check(url.pathname === `/api/articles/genteymas.net/${slug}`, 'Origem editorial inesperada');
	return Response.json(fixture);
}

async function initialPage(classification, env, ctx) {
	const url = `${origin}/r/${slug}/${baseQuery}&utm_content=${classification}`;
	const response = await worker.fetch(new Request(url, { headers: { 'CF-Connecting-IP': '192.0.2.21' } }), env, ctx);
	const html = await response.text(), cookie = response.headers.get('Set-Cookie')?.split(';')[0];
	check(response.status === 200 && !response.headers.has('Location'), 'GET de fingerprint não permaneceu local');
	check(response.headers.get('X-Adspect-Stage') === 'fingerprint_pending' && cookie, 'GET não preparou fingerprint');
	check(response.headers.get('Set-Cookie').includes('Max-Age=60'), 'Cookie não preservou prazo de 60 segundos');
	check(html.includes(`href="${origin}/e/${slug}/"`) && !html.includes('<dialog'), 'GET alterou canônica ou abriu continuação antes do fingerprint');
	check(!poolCount && !destinationCount, 'GET consultou destino sem clique');
	return { url, classification, html, cookie, final: null, profile: 'simulated_continuation_and_images' };
}

async function completeFingerprint(page, env, ctx) {
	const challenge = page.cookie.match(/^_session_([a-f0-9]+)=/)[1];
	const request = new Request(page.url, { method: 'POST',
		headers: { Origin: origin, Cookie: page.cookie, 'CF-Connecting-IP': '192.0.2.21' },
		body: new URLSearchParams({ data: '{"cid":"forged","mode":"php"}', _adspect_challenge: challenge }) });
	const response = await worker.fetch(request, env, ctx);
	page.final = await response.text();
	check(response.status === 200 && !response.headers.has('Location'), 'POST concluído saiu da página local');
	check(response.headers.get('X-Adspect-Stage') === 'complete' && !response.headers.has('Set-Cookie'), 'POST não concluiu sem renovar estado');
	check(page.final.includes(fixture.data.title) && page.final.includes(fixture.data.product_official_url.replaceAll('&', '&amp;')), 'POST trocou artigo ou retirou oferta');
	check(response.headers.get('X-Clickverso-Decision') === page.classification, 'Classificação não foi aplicada no Worker');
	const money = page.classification === 'money';
	check(page.final.includes('<dialog ') === money, 'Modal não corresponde à liberação');
	check(response.headers.get('X-Continuation-State') === (money ? 'ready' : 'local'), 'Estado de continuação incorreto');
	check(page.final.includes(`/go/metaoffers/${fixture.data.id}/en/${new URL(page.url).search.replaceAll('&', '&amp;')}`), 'Oferta perdeu produto, idioma ou query');
	check(!poolCount && !destinationCount, 'POST consultou destino sem clique');
}

async function checkHeads(url, env, ctx) {
	const rpcBefore = rpcCount;
	for (const path of [new URL(url).pathname, `/go/metaoffers/${fixture.data.id}/en/`]) {
		const response = await worker.fetch(new Request(origin + path + new URL(url).search, { method: 'HEAD' }), env, ctx);
		check(response.status === 200 && !response.headers.has('Location') && await response.text() === '', 'HEAD mudou estado ou enviou corpo');
	}
	check(rpcCount === rpcBefore && !poolCount && !destinationCount, 'HEAD consultou Adspect, pool ou parceiro');
}

async function checkClickedDestination(page, env, ctx) {
	const go = `${origin}/go/metaoffers/${fixture.data.id}/en/${new URL(page.url).search}`;
	const rpcBefore = rpcCount;
	const response = await worker.fetch(new Request(go, { headers: { Accept: 'application/json',
		'CF-IPCountry': 'MX', Cookie: 'private=not-forwarded', 'CF-Connecting-IP': '192.0.2.21' } }), env, ctx);
	const result = await response.json(), expected = destination + new URL(page.url).search;
	check(response.status === 200 && !response.headers.has('Location') && result.url === expected, 'Clique não retornou URL do mesmo produto com query preservada');
	check(response.headers.get('X-Product-Destination') === 'matched', 'Clique não validou produto');
	check(rpcCount === rpcBefore && poolCount === 1 && destinationCount === 1, 'Clique repetiu análise ou pulou validação');
	Object.assign(page, { go, goStatus: response.status, goJson: result, destination: expected,
		destinationHtml: '<h1>Berkeley: destino estático da fixture</h1>' });
}

export default { async test(_controller, env, ctx) {
	check(site.observe_only === false && site.fingerprint === true && site.continuation?.en, 'Perfil simulado não configura continuação ativa com fingerprint');
	const pages = [];
	for (const classification of ['money', 'safe']) {
		const page = await initialPage(classification, env, ctx);
		await completeFingerprint(page, env, ctx);
		await checkHeads(page.url, env, ctx);
		pages.push(page);
	}
	check(pages[0].final.split('</article>')[0] === pages[1].final.split('</article>')[0], 'Negação e liberação não mantiveram o mesmo artigo');
	await checkClickedDestination(pages[0], env, ctx);
	check(rpcCount === 4, 'Fingerprint duplicado ou ausente');
	console.log('SITE_FIXTURES:' + JSON.stringify(pages));
	console.log('SITE_OK:' + JSON.stringify({ site: site.id, profile: 'simulated_continuation_and_images', fingerprint: site.fingerprint,
		rpc_count: rpcCount, pool_count: poolCount, destination_checks: destinationCount, fingerprint_posts: pages.length,
		real_site_configuration_validated: false, real_images_validated: false, browser_cancellation_validated: false }));
} };
