import { GDN_FIELDS } from '../navigation/tracking.js';

export const metrics = ['clicks', 'money_hits', 'safe_hits', 'fingerprints', 'givt', 'sivt', 'mia'];

export const gdnBreakdown = {
	available: false,
	dimensions: GDN_FIELDS,
	reason: 'current_sub_id_does_not_record_gdn_dimensions',
	source: 'https://docs.adspect.ai/en/latest/api.html#sales-funnel-breakdown-columns',
};

export function reportRows(text) {
	let data;
	try { data = JSON.parse(text); }
	catch { data = text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)); }
	if (!Array.isArray(data)) throw new Error('Formato de relatório inválido');
	return !data.length || Array.isArray(data[0]) ? data : [data];
}

export function summarize(rows) {
	const totals = Object.fromEntries(metrics.map(key => [key, 0]));
	for (const row of rows) {
		if (row.length !== metrics.length) throw new Error('Colunas inesperadas no relatório');
		row.forEach((value, index) => {
			if (!['string', 'number'].includes(typeof value) || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0) throw new Error('Métrica inválida');
			totals[metrics[index]] += Number(value);
		});
	}
	return { ...totals, money_rate: totals.clicks ? totals.money_hits / totals.clicks : null,
		safe_rate: totals.clicks ? totals.safe_hits / totals.clicks : null,
		mia_rate: totals.clicks ? totals.mia / totals.clicks : null, gdn_breakdown: gdnBreakdown };
}
