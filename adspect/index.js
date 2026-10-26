import fingerprint from './fingerprint.js';
import { GDN_FIELDS } from '../navigation/tracking.js';

const BODY_LIMIT = 1024 * 1024;
const STREAM_ID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const CLICK_ID = /^[a-zA-Z0-9_-]{1,128}$/;
const CHALLENGE_ID = /^[a-f0-9]{32}$/;
const TRACKING_KEYS = new Set([
	...GDN_FIELDS,
	'gclid',
	'dclid',
	'gbraid',
	'wbraid',
	'gclsrc',
	'gad_source',
	'gad_campaignid',
	'_gl',
	'_ga',
	'cl',
	'cluster',
	'rb',
]);
const INTERNAL_KEYS = new Set([
	'_',
	'__sid',
	'_cid',
	'sid',
	'stream',
	'stream_id',
	'mode',
	'action',
	'target',
	'money_pages',
	'safe_pages',
	'enable_fp',
	'filter_level',
]);
const REQUEST_HEADERS = [
	'accept',
	'accept-language',
	'accept-encoding',
	'user-agent',
	'referer',
	'origin',
	'sec-ch-ua',
	'sec-ch-ua-mobile',
	'sec-ch-ua-platform',
	'sec-fetch-dest',
	'sec-fetch-mode',
	'sec-fetch-site',
	'sec-fetch-user',
	'content-type',
	'content-length',
	'cf-ipcountry',
];

class AnalysisError extends Error {}

function attributionQuery(url) {
	if (url.search.length > 8192 || url.searchParams.size > 32) throw new AnalysisError('invalid_query');
	const query = new URLSearchParams();
	for (const [key, value] of url.searchParams) {
		const name = key.toLowerCase();
		if (INTERNAL_KEYS.has(name) || name.startsWith('_adspect'))
			throw new AnalysisError('invalid_query');
		if (!TRACKING_KEYS.has(key) && !/^utm_[a-z0-9_]{1,32}$/.test(key)) continue;
		if (url.searchParams.getAll(key).length !== 1 || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value))
			throw new AnalysisError('invalid_query');
		if (GDN_FIELDS.includes(key) && (!value.trim() || /[{}]/.test(value))) continue;
		if (['cl', 'cluster', 'rb'].includes(key) && !/^\d{1,6}$/.test(value))
			throw new AnalysisError('invalid_query');
		query.set(key, value);
	}
	return query.toString();
}

export async function readLimitedBody(body, signal, limit = BODY_LIMIT) {
	if (!body) throw new AnalysisError('missing_body');
	const reader = body.getReader();
	const chunks = [];
	let size = 0;
	const cancel = () => {
		void reader.cancel().catch(() => {});
	};
	signal.addEventListener('abort', cancel, { once: true });
	try {
		signal.throwIfAborted();
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > limit) {
				cancel();
				throw new AnalysisError('body_too_large');
			}
			chunks.push(value);
		}
		signal.throwIfAborted();
	} finally {
		signal.removeEventListener('abort', cancel);
		reader.releaseLock();
	}
	return new Blob(chunks).text();
}

export async function readFingerprint(
	request,
	signal = AbortSignal.timeout(5000),
	allowInitial = false,
) {
	const url = new URL(request.url);
	if (request.headers.get('Origin') !== url.origin) throw new AnalysisError('invalid_origin');
	if (
		request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !==
		'application/x-www-form-urlencoded'
	) {
		throw new AnalysisError('invalid_content_type');
	}
	const form = new URLSearchParams(await readLimitedBody(request.body, signal));
	const visitFields = form.getAll('_clickverso_visit');
	if (
		allowInitial &&
		visitFields.length <= 1 &&
		form.size === 1 + visitFields.length &&
		form.get('_clickverso_phase') === 'analysis'
	) {
		return { initial: true };
	}
	if (
		form.getAll('data').length !== 1 ||
		form.getAll('_adspect_challenge').length !== 1 ||
		visitFields.length > 1 ||
		form.size !== 2 + visitFields.length
	) {
		throw new AnalysisError('invalid_fingerprint');
	}
	const challenge = form.get('_adspect_challenge');
	if (!CHALLENGE_ID.test(challenge)) throw new AnalysisError('invalid_challenge');
	let data;
	try {
		data = JSON.parse(form.get('data'));
	} catch {
		throw new AnalysisError('invalid_fingerprint');
	}
	if (!data || typeof data !== 'object' || Array.isArray(data))
		throw new AnalysisError('invalid_fingerprint');
	const name = `_session_${challenge}=`;
	const cookies = (request.headers.get('Cookie') || '')
		.split(';')
		.map((value) => value.trim())
		.filter((value) => value.startsWith(name));
	if (!cookies.length && allowInitial) return { initial: true, challenge };
	if (cookies.length !== 1 || !CLICK_ID.test(cookies[0].slice(name.length)))
		throw new AnalysisError('missing_cid');
	return { data: { ...data, cid: cookies[0].slice(name.length) }, challenge };
}

function serverData(request, url, ip, query) {
	const server = {
		REQUEST_METHOD: request.method,
		REQUEST_URI: url.pathname + (query ? `?${query}` : ''),
		QUERY_STRING: query,
		HTTP_HOST: url.host,
		SERVER_NAME: url.hostname,
		SERVER_PORT: url.port || (url.protocol === 'https:' ? '443' : '80'),
		SERVER_PROTOCOL: request.cf?.httpProtocol || 'HTTP/1.1',
		HTTPS: url.protocol === 'https:' ? 'on' : 'off',
		REMOTE_ADDR: ip,
		HTTP_CF_CONNECTING_IP: ip,
	};
	for (const name of REQUEST_HEADERS) {
		const value = request.headers.get(name);
		if (value !== null) server[`HTTP_${name.toUpperCase().replaceAll('-', '_')}`] = value;
	}
	return server;
}

function validateAnalysis(result) {
	if (
		!result ||
		typeof result !== 'object' ||
		Array.isArray(result) ||
		typeof result.cid !== 'string' ||
		!CLICK_ID.test(result.cid) ||
		typeof result.ok !== 'boolean' ||
		typeof result.js !== 'boolean' ||
		typeof result.action !== 'string' ||
		typeof result.target !== 'string'
	)
		throw new AnalysisError('invalid_response');
	if ('e' in result && result.e !== '' && result.e !== null)
		throw new AnalysisError('unsupported_php');
	if (!result.js && (result.action !== 'noop' || result.target !== ''))
		throw new AnalysisError('unsupported_action');
	return result;
}

async function requestAnalysis(request, streamId, fetchProvider, fingerprintInput, initialAnalysis) {
	const signal = AbortSignal.timeout(5000);
	if (!STREAM_ID.test(streamId)) throw new AnalysisError('missing_configuration');
	const url = new URL(request.url);
	if (!/^\/[a-zA-Z0-9/_.%~-]*$/.test(url.pathname)) throw new AnalysisError('invalid_path');
	const query = attributionQuery(url);
	const ip = request.headers.get('CF-Connecting-IP');
	if (!ip) throw new AnalysisError('missing_client_ip');
	const data = initialAnalysis
		? {}
		: (fingerprintInput || (await readFingerprint(request, signal))).data;
	const response = await fetchProvider(`https://rpc.adspect.net/v2/${streamId}?${query}`, {
		method: 'POST',
		redirect: 'manual',
		signal,
		headers: {
			'User-Agent': '',
			'Adspect-IP': ip,
			'Adspect-UA': request.headers.get('User-Agent') || '',
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: JSON.stringify({ ...data, server: serverData(request, url, ip, query) }),
	});
	if (response.status !== 200) throw new AnalysisError('provider_http_error');
	const body = await readLimitedBody(response.body, signal);
	let result;
	try {
		result = JSON.parse(body);
	} catch {
		throw new AnalysisError('invalid_response');
	}
	return validateAnalysis(result);
}

function browserChallenge(pathname, cid) {
	const challenge = crypto.randomUUID().replaceAll('-', '');
	const field = `b=e.createElement("input");b.type="hidden";b.name="_adspect_challenge";b.value="${challenge}";a.appendChild(b);a.submit()`;
	return {
		script: fingerprint.replace('a.submit()', field),
		cookie: `_session_${challenge}=${cid}; Path=${pathname}; Max-Age=60; Secure; HttpOnly; SameSite=Lax`,
	};
}

export async function analyzeAdspect(
	request,
	streamId,
	fetchProvider = fetch,
	fingerprintInput = null,
	initialAnalysis = request.method === 'GET',
) {
	const started = Date.now();
	const analysis = { stage: 'complete', durationMs: 0, ok: null, js: null, script: '', cookie: '' };
	if (!streamId) return { ...analysis, stage: 'disabled' };
	if (!['GET', 'POST'].includes(request.method)) return { ...analysis, stage: 'skipped' };
	try {
		const result = await requestAnalysis(
			request,
			streamId,
			fetchProvider,
			fingerprintInput,
			initialAnalysis,
		);
		analysis.ok = result.ok;
		analysis.js = result.js;
		if (result.js) {
			analysis.stage = 'fingerprint_incomplete';
			// Um reenvio sem o cookie inicia outra análise, mas não repete o coletor em ciclo.
			if (initialAnalysis && !fingerprintInput?.challenge) {
				analysis.stage = 'fingerprint_pending';
				Object.assign(analysis, browserChallenge(new URL(request.url).pathname, result.cid));
			}
		}
	} catch (error) {
		analysis.stage = error instanceof AnalysisError ? error.message : 'provider_unavailable';
		if (error instanceof Error && error.name === 'TimeoutError') analysis.stage = 'analysis_timeout';
	}
	analysis.durationMs = Date.now() - started;
	return analysis;
}

export async function attachAdspect(response, analysis) {
	if (
		['disabled', 'skipped'].includes(analysis.stage) ||
		response.status !== 200 ||
		!response.headers.get('Content-Type')?.toLowerCase().startsWith('text/html')
	)
		return response;
	const headers = new Headers(response.headers);
	headers.set('Cache-Control', 'private, no-store');
	headers.set('CDN-Cache-Control', 'no-store');
	headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
	headers.set('X-Adspect-Stage', analysis.stage);
	if (analysis.cookie) headers.append('Set-Cookie', analysis.cookie);
	let body = response.body;
	if (analysis.script) {
		const html = await response.text();
		body = /<\/body\s*>/i.test(html)
			? html.replace(/<\/body\s*>/i, (close) => analysis.script + close)
			: html + analysis.script;
		headers.delete('Content-Length');
		headers.delete('ETag');
	}
	return new Response(body, { status: response.status, statusText: response.statusText, headers });
}
