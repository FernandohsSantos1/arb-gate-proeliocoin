import { Router } from 'itty-router';
import site from '#site';

import Category from './controllers/Category';
import Contact from './controllers/Contact';
import Author from './controllers/Author';
import Page from './controllers/Page';
import constants from './constants';
import Home from './controllers/Home';
import Post from './controllers/Post';
import Landing from './controllers/Landing';
import Aggregator from './controllers/Aggregator';
import Caching from './models/Caching';
import Requests from './models/Requests';
import Sitemap from './controllers/Sitemap';
import Loading from './controllers/Loading';
import KV from './models/KV';
import Search from './controllers/Search';
import { resolveSharedRoute, handleSharedContent } from './content/routes.js';
import { handleSharedImage } from './content/images.js';
import { attachAnalytics } from './content/analytics.js';
import { analyzeAdspect, attachAdspect } from './adspect/index.js';
import { handleContentRedirect, attachNavigation } from './navigation/index.js';
import { prepareVisitPost } from './visits/index.js';

const languages = constants.LANGUAGES;

const router = Router();

const defaultLang = languages[0];
const supportedLangs = languages.slice(1); // ['en', 'es']

router.get('/sitemap.xml', Sitemap.sitemapXml);

for (let lang of supportedLangs) {
	router.get(`/${lang}/sitemap.xml`, Caching.defaultCache, Sitemap.sitemapXml);
}

router.get('/loading/:lang/', Caching.defaultCache, Loading.index);

router.get('/ads.txt', Caching.kvCache, async (request, env, ctx) => {
	let config = await Requests.getDomainConfig(constants.CMS_DOMAIN);
	let content = '';

	if (config && config.config) {
		content = config.config?.ads_txt;
	}

	let response = new Response(content, {
		status: 200,
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': `public, max-age=${constants.CACHE_CONTROL_TIME}`,
		},
	});

	//ctx.waitUntil(caches.default.put(request.url.split('?')[0], response.clone()));
	if (content && content.length > 10) {
		ctx.waitUntil(KV.post(env, `${constants.DOMAIN}-ads.txt`, content));
	}

	return response;
});

router.get('/robots.txt', Caching.defaultCache, async (request, env, ctx) => {
	let config = await Requests.getDomainConfig(constants.CMS_DOMAIN);
	let content = '';

	if (config && config.config) {
		content = config.config?.robots_txt;
	}

	let response = new Response(content, {
		status: 200,
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': `public, max-age=${constants.CACHE_CONTROL_TIME}`,
		},
	});

	ctx.waitUntil(caches.default.put(request.url.split('?')[0], response.clone()));

	return response;
});

// Home Page
router.get('/', (request, env, ctx) => {
	return Home.handleHomeLang(defaultLang, request, env, ctx);
});

router.post('/api/contact/message/', Contact.receiveMessage);

// Categorias - /c/:slug/*
router.get('/c/:slug/*', Caching.defaultCache, (request, env, ctx) => {
	const { slug } = request.params;

	const url = new URL(request.url);
	const pathname = url.pathname;
	const segments = pathname.split('/').filter((segment) => segment.length > 0);
	const lastSegment = segments[segments.length - 1];
	const pageNum = parseInt(lastSegment, 10);
	const validPage = Number.isInteger(pageNum) && pageNum > 0 ? pageNum : 1;

	return Category.handleLang(defaultLang, slug, validPage, request, env, ctx);
});

// Posts - /p/:slug/*
router.get('/p/:slug/*', Caching.defaultCache, (request, env, ctx) => {
	const { slug } = request.params;
	return Post.handleLang(defaultLang, slug, request, env, ctx);
});

// Landings - /l/:slug/*
router.get('/l/:slug/*', Caching.defaultCache, (request, env, ctx) => {
	const { slug } = request.params;
	return Landing.handleLang(defaultLang, slug, request, env, ctx);
});

// Aggregators - /m/:slug/*
router.get('/m/:slug/*', Caching.defaultCache, (request, env, ctx) => {
	const { slug } = request.params;
	return Aggregator.handleAggregatorLang(defaultLang, slug, request, env, ctx);
});

router.get('/a/', Caching.defaultCache, (request, env, ctx) => {
	return Author.authorsListLang(defaultLang, request, env, ctx);
});

// Autores - /a/:slug/*
router.get('/a/:slug/*', Caching.defaultCache, (request, env, ctx) => {
	const { slug } = request.params;

	const url = new URL(request.url);
	const pathname = url.pathname;
	const segments = pathname.split('/').filter((segment) => segment.length > 0);
	const lastSegment = segments[segments.length - 1];
	const pageNum = parseInt(lastSegment, 10);
	const validPage = Number.isInteger(pageNum) && pageNum > 0 ? pageNum : 1;

	return Author.handleLang(defaultLang, slug, validPage, request, env, ctx);
});

// Páginas Estáticas - /s/:slug/*
router.get('/s/:slug/*', Caching.defaultCache, (request, env, ctx) => {
	const { slug } = request.params;
	return Page.handleLang(defaultLang, slug, request, env, ctx);
});

router.get('/search/', (request, env, ctx) => {
	return Search.handleSearchRequest(defaultLang, request, env, ctx);
});

// Routes for other languages
supportedLangs.forEach((lang) => {
	// Home Page - /:lang/
	router.get(`/${lang}/`, Caching.kvCache, (request, env, ctx) => {
		return Home.handleHomeLang(lang, request, env, ctx);
	});

	// Categorias - /:lang/c/:slug/*
	router.get(`/${lang}/c/:slug/*`, Caching.defaultCache, (request, env, ctx) => {
		const { slug } = request.params;

		const url = new URL(request.url);
		const pathname = url.pathname;
		const segments = pathname.split('/').filter((segment) => segment.length > 0);
		const lastSegment = segments[segments.length - 1];
		const pageNum = parseInt(lastSegment, 10);
		const validPage = Number.isInteger(pageNum) && pageNum > 0 ? pageNum : 1;

		return Category.handleLang(lang, slug, validPage, request, env, ctx);
	});

	// Posts - /:lang/p/:slug/*
	router.get(`/${lang}/p/:slug/*`, Caching.defaultCache, (request, env, ctx) => {
		const { slug } = request.params;
		return Post.handleLang(lang, slug, request, env, ctx);
	});

	// Landings - /:lang/l/:slug/*
	router.get(`/${lang}/l/:slug/*`, Caching.defaultCache, (request, env, ctx) => {
		const { slug } = request.params;
		return Landing.handleLang(lang, slug, request, env, ctx);
	});

	// Aggregators - /m/:slug/*
	router.get(`/${lang}/m/:slug/*`, Caching.defaultCache, (request, env, ctx) => {
		const { slug } = request.params;
		return Aggregator.handleAggregatorLang(lang, slug, request, env, ctx);
	});

	router.get(`/${lang}/a/`, Caching.defaultCache, (request, env, ctx) => {
		return Author.authorsListLang(lang, request, env, ctx);
	});

	// Autores - /:lang/a/:slug/*
	router.get(`/${lang}/a/:slug/*`, Caching.defaultCache, (request, env, ctx) => {
		const { slug } = request.params;

		const url = new URL(request.url);
		const pathname = url.pathname;
		const segments = pathname.split('/').filter((segment) => segment.length > 0);
		const lastSegment = segments[segments.length - 1];
		const pageNum = parseInt(lastSegment, 10);
		const validPage = Number.isInteger(pageNum) && pageNum > 0 ? pageNum : 1;

		return Author.handleLang(lang, slug, validPage, request, env, ctx);
	});

	// Páginas Estáticas - /:lang/s/:slug/*
	router.get(`/${lang}/s/:slug/*`, Caching.defaultCache, (request, env, ctx) => {
		const { slug } = request.params;
		return Page.handleLang(lang, slug, request, env, ctx);
	});

	router.get(`/${lang}/search/`, (request, env, ctx) => {
		return Search.handleSearchRequest(lang, request, env, ctx);
	});
});

// Handle favicon + public assets
router.get('/favicon.ico', Caching.defaultCache, async (request, env, ctx) => {
	try {
		const assetRequest = new Request(new URL('', request.url), request);
		const response = await env.ASSETS.fetch(assetRequest);
		return response;
	} catch (e) {
		console.log('erro ao buscar asset', e);
	}
});

router.get('/public/*', Caching.defaultCache, async (request, env, ctx) => {
	try {
		const url = new URL(request.url);
		const assetPath = url.pathname.replace(/^\/public/, '') || '/index.html';

		const assetRequest = new Request(new URL(assetPath, request.url), request);
		const response = await env.ASSETS.fetch(assetRequest);
		return response;
	} catch (e) {
		console.log(e);
	}
});

// Handle CORS preflight
/*function handleOptions(request) {
	let headers = new Headers();
	headers.set('Access-Control-Allow-Origin', '*');
	headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
	headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

	return new Response(null, {
		status: 204,
		headers: headers,
	});
}*/

// 404 handler
import NotFound from './controllers/NotFound';
router.all('*', (request, env, ctx) => {
	return NotFound.index(defaultLang, request, env, ctx);
});

// Export the worker
/*
export default {
	fetch: (request, env, ctx) => {
		//if (request.method === 'OPTIONS') {
		//	return handleOptions(request);
		//} else {
			return router.handle(request, env, ctx);
		//}
	},
};*/

// Private IPv4 ranges (loopback 127/8 and RFC 1918: 10/8, 172.16/12, 192.168/16).
// They are never routable on the internet, so they only show up in local development
const PRIVATE_IP_HOST = new RegExp(
	[
		'^127\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$',
		'^10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$',
		'^172\\.(1[6-9]|2\\d|3[01])\\.\\d{1,3}\\.\\d{1,3}$',
		'^192\\.168\\.\\d{1,3}\\.\\d{1,3}$',
	].join('|')
);

export default {
	fetch: async (request, env, ctx) => {
		let url = new URL(request.url);
		let needRedirect = false;
		let redirectWith301 = false;

		console.log(JSON.stringify({ event: 'request', method: request.method, path: url.pathname }));
		if (
			(url.protocol !== 'https:' || url.hostname !== constants.DOMAIN) &&
			!url.hostname.includes('localhost') &&
			!PRIVATE_IP_HOST.test(url.hostname) // local dev via loopback or LAN IP
		) {
			url.protocol = 'https:';

			// Remove 'www.' from the hostname if present
			if (url.hostname.startsWith('www.')) {
				url.hostname = url.hostname.slice(4);
				redirectWith301 = true;
				needRedirect = true;
			}

			if (url.hostname !== constants.DOMAIN) {
				url.hostname = constants.DOMAIN;
				needRedirect = true;
			}

			//To activate the middle, uncomment this line
			// needRedirect = true;
		}

		// Check if the first path segment is the default language
		const pathSegments = url.pathname.split('/').filter((segment) => segment.length > 0);
		if (pathSegments.length > 0 && pathSegments[0] === constants.LANGUAGES[0] && !resolveSharedRoute(url.pathname)) {
			// Remove the first segment
			pathSegments.shift();

			// Reconstruct the pathname
			url.pathname = '/' + pathSegments.join('/') + (pathSegments.length > 0 ? '/' : '');

			needRedirect = true;
		}

		// If the URL doesn't end with a slash and doesn't have an extension
		if (!url.pathname.endsWith('/') && !url.pathname.includes('.')) {
			url.pathname += '/';
			needRedirect = true;
		}

		if (needRedirect) {
			if (request.method === 'POST') return Response.redirect(url.toString(), 307);
			if (redirectWith301) {
				return Response.redirect(url.toString(), 301);
			}

			return Response.redirect(url.toString(), 302);
		}

		const sharedImage = await handleSharedImage(request, env);
		if (sharedImage) return sharedImage;

		const contentRedirect = await handleContentRedirect(request);
		if (contentRedirect) return contentRedirect;

		const route = resolveSharedRoute(url.pathname);
		const fingerprintPost = route?.kind === 'article' && request.method === 'POST' && env.ADSPECT_STREAM_ID;
		const prepared = fingerprintPost ? await prepareVisitPost(request) : null;
		if (prepared?.response) return prepared.response;
		const contentUrl = new URL(request.url);
		if (route?.kind === 'article' && route.format === 'landing') contentUrl.pathname = route.entry.canonical_path;
		const contentRequest = new Request(contentUrl, { method: fingerprintPost ? 'GET' : request.method });
		const sharedContent = await handleSharedContent(contentRequest, ctx);
		if (sharedContent) {
			if (route.kind !== 'article' || sharedContent.status !== 200 || request.method === 'HEAD') return sharedContent;
			const analysis = await analyzeAdspect(request, env.ADSPECT_STREAM_ID, fetch, prepared, prepared?.initial || request.method === 'GET');
			const decision = route.format !== 'landing' ? 'local_read' : site.observe_only ? 'observe'
				: analysis.stage === 'complete' ? analysis.ok ? 'money' : 'safe' : analysis.js ? 'incomplete' : 'unavailable';

			let response;
			if (decision === 'money') {
				// Servir money page local (playbook conform)
				const moneyPagePath = '/money-page-a3f8b2c1.html';
				const assetRequest = new Request(new URL(moneyPagePath, request.url), request);
				response = await env.ASSETS.fetch(assetRequest);

				// Injetar config no HTML
				if (response.status === 200) {
					const html = await response.text();
					const endpoint = `/go/metaoffers/${route.entry.source_id}/${route.entry.lang}/`;
					const configScript = `window.MONEY_PAGE_CONFIG = { endpoint: "${endpoint}", sourceId: "${route.entry.source_id}", lang: "${route.entry.lang}", article: { title: "${route.entry.title.replace(/"/g, '&quot;')}", image: "${route.entry.image || ''}" } };`;
					const updatedHtml = html.replace('</head>', `${configScript}</head>`);
					response = new Response(updatedHtml, response);
				}
			} else {
				response = await attachNavigation(sharedContent, request, route, analysis);
			}

			if (!['disabled', 'skipped'].includes(analysis.stage)) console.log(JSON.stringify({ event: 'adspect_analysis',
				site_id: site.id, experiment: site.experiment, revision: site.revision,
				source: route.entry.source, source_id: route.entry.source_id, product_id: route.entry.product_id, method: request.method,
				stage: analysis.stage, duration_ms: analysis.durationMs, ok: analysis.ok, js: analysis.js,
				decision, destination: 'local', status: response.status }));
			if (response.status === 200) response = await attachAnalytics(response, request);
			response = new Response(response.body, response);
			response.headers.set('X-Clickverso-Decision', decision);
			return attachAdspect(response, analysis);
		}

		// Process the request with the router
		let response = await router.handle(request, env, ctx);

		return response;
	},
};
