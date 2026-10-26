import constants from '../constants';

class Sitemap {
	async sitemapXml(request, env, ctx) {
		try {
			const url = new URL(request.url);
			const pathname = url.pathname;
			const defaultLanguage = constants.LANGUAGES[0];
			const domainParam = constants.CMS_DOMAIN;

			let languageParam = defaultLanguage; // Default to the default language

			// Extract language from the URL if present
			const sitemapMatch = pathname.match(/^\/([a-z]{2})?\/?sitemap\.xml$/);

			if (sitemapMatch) {
				const langFromUrl = sitemapMatch[1];
				if (langFromUrl && constants.LANGUAGES.includes(langFromUrl)) {
					languageParam = langFromUrl;
				}
			} else {
				// URL does not match expected pattern
				return new Response('Not Found', { status: 404 });
			}

			// Build the CMS API URL with the language parameter
			let cmsApiUrl = `https://metacms.highstakes.tech/api/sitemaps/get/?domain=${domainParam}&default-language=${defaultLanguage}&language=${languageParam}`;

			for (let query in request.query) {
				cmsApiUrl += `&${query}=${request.query[query]}`;
			}
			
			const response = await fetch(cmsApiUrl);
			const data = await response.json();

			if (!data.urls || data.urls.length === 0) {
				return new Response('No URLs found', { status: 404 });
			}

			const urls = data.urls.map(value => { const url = new URL(value); url.hostname = constants.DOMAIN; return url.href; });

			// Construct the XML sitemap
			let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n`;
			xmlContent += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

			urls.forEach((url) => {
				xmlContent += `    <url>\n`;
				xmlContent += `        <loc>${url}</loc>\n`;
				xmlContent += `    </url>\n`;
			});

			xmlContent += `</urlset>`;

			// Return the XML response
			let resp = new Response(xmlContent, {
				status: 200,
				headers: {
					'Content-Type': 'application/xml',
				},
			});

			// Optionally cache the response
			ctx.waitUntil(caches.default.put(request.url, resp.clone()));

			return resp;
		} catch (error) {
			console.error('Error in sitemapXml:', error);
			return new Response('Internal server error', { status: 500 });
		}
	}
}

export default new Sitemap();
