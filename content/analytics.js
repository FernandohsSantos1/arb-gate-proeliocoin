import { siteAnalytics } from './layout.js';

export async function attachAnalytics(response, request) {
	if (!siteAnalytics) return response;
	if (!['GET', 'POST'].includes(request.method)) return response;
	const resume = request.method === 'POST';
	const init = `(function(){
		var key='clickverso:pageview',url=location.pathname+location.search;
		var options={autoCapturePageviews:${!resume}};
		try {
			var saved=JSON.parse(sessionStorage.getItem(key)||'null');
			var age=saved?Date.now()-saved.at:Infinity;
			var prepared=${resume}&&saved&&saved.url===url&&saved.at>0&&age>=0&&age<60000;
			sessionStorage.setItem(key,JSON.stringify(prepared?saved:{url:url,at:0}));
			options.autoCapturePageviews=!prepared;
			options.transformRequest=function(payload){
				if(payload.n==='pageview')try{sessionStorage.setItem(key,JSON.stringify({url:url,at:Date.now()}));}catch(_){}
				return payload;
			};
		} catch(_) {}
		plausible.init(options);
	})();`;
	const snippet = siteAnalytics.replace('<script>', `<script data-clickverso-analytics data-resume="${resume}">`)
		.replace('plausible.init()', init);
	const html = await response.text();
	// O cache anterior a esta correção ainda pode conter HTML sem o snippet.
	const body = html.includes(siteAnalytics) ? html.replace(siteAnalytics, snippet) : html.replace('</head>', snippet + '</head>');
	const headers = new Headers(response.headers);
	headers.delete('Content-Length');
	headers.delete('ETag');
	if (resume) headers.set('Cache-Control', 'private, no-store');
	return new Response(body, { status: response.status, statusText: response.statusText, headers });
}
