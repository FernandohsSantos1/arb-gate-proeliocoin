export function streamSettings(site) {
	return {
		name: site.id, mode: 'Filter',
		notes: 'Observação de qualidade de tráfego. A classificação não controla conteúdo nem destino.',
		tags: ['observation', site.experiment, site.id],
		money_pages: [{ page: '', action: 'noop', arg_passthru: false, weight: 1, enabled: true }],
		safe_pages: [{ page: '', action: 'noop', arg_passthru: false }],
		filter_level: 2, enable_fp: site.fingerprint, enable_ua: true,
		skip_clicks: 0, require_unique: false, require_touch: false, require_web3: false,
		allow_apps: true, allow_embed: true, allow_google_proxy: true, allow_apple_proxy: true,
		countries: [], os: [], browsers: [], engines: [], languages: [],
		require_language: false, tz_match_ip: false, ip_on_review: false,
		sub_id: '{host}{path}|{p:utm_campaign}', click_id: '', click_cost: '',
	};
}

export function verifyStream(expected, actual, path = '') {
	for (const [key, value] of Object.entries(expected)) {
		const found = actual?.[key];
		const field = path + key;
		if (Array.isArray(value) && (!Array.isArray(found) || found.length !== value.length)) throw new Error(`Configuração divergente: ${field}`);
		if (value !== null && typeof value === 'object') verifyStream(value, found, field + '.');
		else if (typeof value === 'boolean' ? found !== value && found !== Number(value) : found !== value) throw new Error(`Configuração divergente: ${field}`);
	}
}
