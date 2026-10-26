import { readFingerprint } from '../adspect/index.js';
import site from '#site';

const STATUS = { invalid_origin: 403, invalid_content_type: 415, body_too_large: 413,
	missing_cid: 403, fingerprint_upload_timeout: 408 };

export async function prepareVisitPost(request) {
	try { return await readFingerprint(request, undefined, true); }
	catch (error) {
		const reason = error.name === 'TimeoutError' ? 'fingerprint_upload_timeout'
			: ['invalid_origin', 'invalid_content_type', 'missing_body', 'body_too_large', 'invalid_fingerprint',
				'invalid_challenge', 'missing_cid'].includes(error.message) ? error.message : 'invalid_fingerprint';
		const status = STATUS[reason] || 400;
		console.log(JSON.stringify({ source: `${site.id}.visit`, site_id: site.id, revision: site.revision, event: 'request_rejected',
			reason, status, method: request.method, path: new URL(request.url).pathname }));
		return { response: new Response(null, { status, headers: {
			'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store', 'Cloudflare-CDN-Cache-Control': 'no-store',
			'Content-Type': 'text/html; charset=utf-8', 'X-Clickverso-Reason': reason, 'X-Robots-Tag': 'noindex, nofollow',
		} }) };
	}
}
