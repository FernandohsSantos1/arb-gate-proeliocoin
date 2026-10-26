export const GDN_FIELDS = ['placement', 'network', 'campaignid', 'adgroupid', 'creative', 'device'];

const TRACKING_KEYS = new Set([...GDN_FIELDS, 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id',
	'gclid', 'dclid', 'wbraid', 'gbraid', 'gclsrc', 'gad_source', 'gad_campaignid', '_gl', '_ga',
	'mb', 'mb_juro', 'pixel', 'pixel_juro']);

const DESTINATION_KEYS = new Set(['url', 'target', 'destination', 'destination_url', 'redirect', 'redirect_url',
	'redirect_to', 'redirect_uri', 'return_url', 'next', 'host', 'hostname', 'domain', 'path', 'offer', 'offer_id', 'product', 'product_id', 'lang', 'language',
	'_', '__sid', '_cid', 'sid', 'stream', 'stream_id', 'mode', 'action', 'money_pages', 'safe_pages', 'enable_fp', 'filter_level']);

export function navigationSearch(search) {
	const params = new URLSearchParams(search);
	const oversized = search.length > 8192 || params.size > 32;
	const rejected = new Set();
	for (const [key, value] of params) {
		const name = key.toLowerCase();
		if (params.getAll(key).length !== 1 || DESTINATION_KEYS.has(name) || name.startsWith('_adspect') || name.startsWith('_clickverso') ||
			/[\u0000-\u001f\u007f]/.test(key + value) ||
			GDN_FIELDS.includes(name) && (oversized || value.length > 2048 || !value.trim() || /[{}]/.test(value))) rejected.add(key);
	}
	if (!rejected.size) return search;
	for (const key of rejected) params.delete(key);
	return params.size ? `?${params}` : '';
}

export function campaignQuery(params) {
	const query = new URLSearchParams();
	if (params.toString().length > 8192 || params.size > 32) return query;
	for (const [key, value] of params) {
		if (!TRACKING_KEYS.has(key) || params.getAll(key).length !== 1 || value.length > 2048 ||
			/[\u0000-\u001f\u007f]/.test(value) || GDN_FIELDS.includes(key) && (!value.trim() || /[{}]/.test(value))) continue;
		query.set(key, value);
	}
	return query;
}
