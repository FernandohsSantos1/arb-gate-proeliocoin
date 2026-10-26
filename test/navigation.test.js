import { expect, test } from 'bun:test';
import { attachNavigation, handleContentRedirect, navigationSearch } from '../navigation/index.js';
import { resolveSharedRoute } from '../content/routes.js';
import catalog from '../content/source-catalog.json';
import site from '#site';

const entry = catalog.articles.find(article => article.source === 'metaoffers'), origin = `https://${site.domain}`;
const html = '<html><head><title>Artigo</title></head><body><article>Conteúdo da fixture</article></body></html>';
const page = () => new Response(html, { headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=3600' } });

test.each([true, false])('sem configuração de modal ok=%s nunca redireciona ou consulta outro serviço', async ok => {
	const request = new Request(`${origin}/r/${entry.slug}/?gclid=click`), route = resolveSharedRoute(new URL(request.url).pathname);
	const response = await attachNavigation(page(), request, route, { stage: 'complete', ok });
	expect(response.status).toBe(200); expect(response.headers.get('Location')).toBeNull();
	expect(response.headers.get('X-Continuation-State')).toBe('configuration_missing');
	expect(await response.text()).toBe(html);
});

test.each(['r', 'i', 'e', 'o'])('POST local em %s preserva histórico e conteúdo', async prefix => {
	const request = new Request(`${origin}/${prefix}/${entry.slug}/?gclid=click`, { method: 'POST' });
	const response = await attachNavigation(page(), request, resolveSharedRoute(new URL(request.url).pathname), { stage: 'complete', ok: false });
	const body = await response.text(), script = body.match(/<script data-clickverso-history>(.*?)<\/script>/)[1];
	const state = { article: 'kept' }, updates = [];
	new Function('history', 'location', script)({ state, replaceState: (...args) => updates.push(args) }, { href: request.url });
	expect(updates).toEqual([[state, '', request.url]]);
	expect(response.status).toBe(200); expect(response.headers.get('Location')).toBeNull();
	expect(body.replace(/<script data-clickverso-history>.*?<\/script>/, '')).toBe(html);
});

test('HEAD e erros mantêm status e resposta original', async () => {
	const url = `${origin}/r/${entry.slug}/`, route = resolveSharedRoute(new URL(url).pathname);
	for (const [response, request] of [[page(), new Request(url, { method: 'HEAD' })], [new Response('Indisponível', { status: 502 }), new Request(url)]]) {
		expect(await attachNavigation(response, request, route, { stage: 'complete', ok: true })).toBe(response);
	}
});

test('sanitização mantém atribuição e remove controles, duplicatas e caracteres de controle', () => {
	const query = '?gclid=click&pixel=AW-test%2Flabel&placement=publisher.example&target=https://outside.example&url=https://outside.example&stream_id=bad&_adspect_cid=bad&custom=%00&duplicate=a&duplicate=b';
	const params = new URLSearchParams(navigationSearch(query));
	expect(Object.fromEntries(params)).toEqual({ gclid: 'click', pixel: 'AW-test/label', placement: 'publisher.example' });
});

test('go sem configuração informa pendência e não recupera via High Offers', async () => {
	const response = await handleContentRedirect(new Request(`${origin}/go/metaoffers/${entry.source_id}/${entry.lang}/?gclid=click`));
	expect(response.status).toBe(503); expect(response.headers.get('Location')).toBeNull();
	expect(response.headers.get('X-Continuation-State')).toBe('configuration_missing');
});

test('go conhecido em HEAD não consulta destino nem navega', async () => {
	const response = await handleContentRedirect(new Request(`${origin}/go/metaoffers/${entry.source_id}/${entry.lang}/`, { method: 'HEAD' }));
	expect(response.status).toBe(200); expect(response.headers.get('Location')).toBeNull(); expect(await response.text()).toBe('');
});

test.each([['/go/metaoffers/unknown/pt/', 'GET', 404], ['/go/metaoffers/99999999/pt/', 'GET', 404],
	['/go/metaoffers/1/pt/', 'POST', 405], ['/go/metacms/1/en/', 'GET', 404]])('go %s %s valida contrato', async (path, method, status) => {
	const response = await handleContentRedirect(new Request(origin + path, { method }));
	expect(response.status).toBe(status); expect(response.headers.get('Location')).toBeNull();
});
