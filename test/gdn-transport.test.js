import { expect, test } from 'bun:test';
import { analyzeAdspect } from '../adspect/index.js';
import { GDN_FIELDS, campaignQuery, navigationSearch } from '../navigation/tracking.js';
import { gdnBreakdown, metrics, summarize } from '../experiments/report.js';

const stream = '11111111-1111-1111-1111-111111111111';
const fields = { placement: 'mobileapp::2-com.example.app', network: 'd',
	campaignid: '18446744073709551615', adgroupid: '9007199254740993', creative: '9007199254740995', device: 'm' };
const params = new URLSearchParams({ ...fields, utm_source: 'google', utm_campaign: 'ygd_123_21',
	gclid: 'google-click', dclid: 'display-click', gbraid: 'braid-g', wbraid: 'braid-w', pixel: 'AW-123/label' });

function analysisRequest(search) {
	return new Request('https://gate.example/r/course/?' + search,
		{ headers: { 'CF-Connecting-IP': '203.0.113.1', 'User-Agent': 'test-browser' } });
}

test('GDN chega ao RPC e ao server QUERY_STRING sem converter IDs de 64 bits', async () => {
	let calls = 0;
	const result = await analyzeAdspect(analysisRequest(params), stream, async (url, options) => {
		calls++;
		const query = new URL(url).searchParams, body = JSON.parse(options.body);
		for (const key of GDN_FIELDS) expect(query.get(key)).toBe(fields[key]);
		expect(body.server.QUERY_STRING).toBe(query.toString());
		expect(body.server.REQUEST_URI).toBe('/r/course/?' + query);
		for (const key of ['gclid', 'dclid', 'gbraid', 'wbraid']) expect(query.get(key)).toBe(params.get(key));
		expect(options.redirect).toBe('manual');
		return Response.json({ cid: 'test-click', ok: true, js: false, action: 'noop', target: '' });
	});
	expect(calls).toBe(1);
	expect(result.stage).toBe('complete');
	expect(result.ok).toBe(true);
});

test('GDN, identificadores de clique e pixel passam na query da navegação', () => {
	const search = '?' + params;
	expect(navigationSearch(search)).toBe(search);
	expect(campaignQuery(params).toString()).toBe(params.toString());
	expect(campaignQuery(new URLSearchParams()).size).toBe(0);
});

for (const key of GDN_FIELDS) {
	test(`campo GDN duplicado ${key} invalida RPC e sai da navegação`, async () => {
		let calls = 0;
		const search = `${key}=first&${key}=second&utm_source=google`;
		const result = await analyzeAdspect(analysisRequest(search), stream, async () => { calls++; });
		expect(result.stage).toBe('invalid_query');
		expect(calls).toBe(0);
		expect(navigationSearch('?' + search)).toBe('?utm_source=google');
		expect(campaignQuery(new URLSearchParams(search)).toString()).toBe('utm_source=google');
	});

	test.each(['', ' ', `{${key}}`])(`campo GDN ${key} vazio ou macro não resolvida não vira valor: %s`, async value => {
		const query = new URLSearchParams({ [key]: value, utm_source: 'google' });
		const result = await analyzeAdspect(analysisRequest(query), stream, async url => {
			expect(new URL(url).searchParams.has(key)).toBe(false);
			return Response.json({ cid: 'test-click', ok: false, js: false, action: 'noop', target: '' });
		});
		expect(result.stage).toBe('complete');
		expect(navigationSearch('?' + query)).toBe('?utm_source=google');
		expect(campaignQuery(query).toString()).toBe('utm_source=google');
	});
}

test('duplicata com macro vazia também falha antes do RPC', async () => {
	const result = await analyzeAdspect(analysisRequest('placement={placement}&placement=publisher.example'), stream,
		async () => { throw new Error('RPC não deve ser consultado'); });
	expect(result.stage).toBe('invalid_query');
});

test.each(['target', 'stream_id', 'action', '_adspect_mode'])('controle %s continua rejeitado pelo RPC e removido da saída', async key => {
	const query = new URLSearchParams({ placement: 'publisher.example', [key]: 'unsafe' });
	const result = await analyzeAdspect(analysisRequest(query), stream, async () => { throw new Error('RPC não deve ser consultado'); });
	expect(result.stage).toBe('invalid_query');
	expect(navigationSearch('?' + query)).toBe('?placement=publisher.example');
});

test.each(['product_id', 'product', 'url', 'domain', 'redirect_url'])('query não controla %s no destino', key => {
	expect(navigationSearch('?network=d&' + key + '=unsafe')).toBe('?network=d');
});

test.each(['x'.repeat(2049), 'publisher\u0000.example'])('valor GDN fora dos limites sai da navegação e não chega ao RPC', async value => {
	const query = new URLSearchParams({ placement: value, utm_source: 'google' });
	const result = await analyzeAdspect(analysisRequest(query), stream, async () => { throw new Error('RPC não deve ser consultado'); });
	expect(result.stage).toBe('invalid_query');
	expect(navigationSearch('?' + query)).toBe('?utm_source=google');
	expect(campaignQuery(query).toString()).toBe('utm_source=google');
});

test.each([
	'?' + new URLSearchParams(Array.from({ length: 33 }, (_, index) => ['utm_' + index, 'x'])),
	'?placement=' + 'x'.repeat(8192),
])('query acima do limite não é transportada', async search => {
	const result = await analyzeAdspect(analysisRequest(search.slice(1)), stream, async () => { throw new Error('RPC não deve ser consultado'); });
	expect(result.stage).toBe('invalid_query');
	const outbound = new URLSearchParams(navigationSearch(search));
	for (const key of GDN_FIELDS) expect(outbound.has(key)).toBe(false);
	expect(campaignQuery(new URLSearchParams(search)).size).toBe(0);
});

test('relatório informa indisponibilidade das seis dimensões GDN com sub_id atual', () => {
	const result = summarize([metrics.map(key => key === 'clicks' ? 2 : key === 'money_hits' || key === 'safe_hits' ? 1 : 0)]);
	expect(result.clicks).toBe(2);
	expect(result.money_rate).toBe(0.5);
	expect(result.gdn_breakdown).toEqual(gdnBreakdown);
	expect(result.gdn_breakdown.available).toBe(false);
	expect(result.gdn_breakdown.dimensions).toEqual(GDN_FIELDS);
	expect(result.gdn_breakdown.reason).toBe('current_sub_id_does_not_record_gdn_dimensions');
	expect(summarize([]).gdn_breakdown.available).toBe(false);
	expect(result).not.toHaveProperty('placement');
	expect(result).not.toHaveProperty('revenue');
});

test.each([
	['label ausente', { utm_source: 'google', pixel: 'AW-123' }],
	['label vazia', { utm_source: 'google', pixel: 'AW-123/' }],
	['label fora do formato do destino', { utm_source: 'google', pixel: 'AW-123/invalid.label' }],
	['alias isolado não vira pixel', { utm_source: 'google', pixel_juro: 'AW-123/alias-label' }],
	['origem com inicial maiúscula não vira google', { utm_source: 'Google', pixel: 'AW-123/valid-label' }],
	['platform não fabrica utm_source', { platform: 'google', pixel: 'AW-123/valid-label' }],
	['pixel e alias distintos não se substituem', { utm_source: 'google', pixel: 'AW-123/primary-label', pixel_juro: 'AW-456/alias-label' }],
])('contrato de transporte do pixel: %s', async (_label, input) => {
	const params = new URLSearchParams(input), search = '?' + params;
	const outbound = new URLSearchParams(navigationSearch(search));
	expect(Object.fromEntries(outbound)).toEqual(input);
	const campaign = campaignQuery(params);
	expect(campaign.get('pixel')).toBe(outbound.get('pixel'));
	expect(campaign.get('pixel_juro')).toBe(outbound.get('pixel_juro'));
	expect(campaign.get('utm_source')).toBe(outbound.get('utm_source'));
	let calls = 0;
	const result = await analyzeAdspect(analysisRequest(params), stream, async (url, options) => {
		calls++;
		const query = new URL(url).searchParams;
		expect(query.get('utm_source')).toBe(params.get('utm_source'));
		for (const key of ['pixel', 'pixel_juro', 'platform']) expect(query.has(key)).toBe(false);
		expect(JSON.parse(options.body).server.QUERY_STRING).toBe(query.toString());
		return Response.json({ cid: 'pixel-transport-only', ok: true, js: false, action: 'noop', target: '' });
	});
	expect(calls).toBe(1);
	expect(result.stage).toBe('complete');
});

