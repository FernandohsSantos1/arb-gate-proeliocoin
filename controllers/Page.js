import Template from '../models/Template';
import Requests from '../models/Requests';
import constants from '../constants';
import Elements from '../models/Elements';
import Util from '../models/Util';
import NotFound from './NotFound';
import Contact from './Contact';

class Page {
	async handleLang(lang, slug, request, env, ctx) {
		try {
			if (slug == 'contact') {
				return Contact.handleLang(lang, request, env, ctx);
			}

			let pageData = await Requests.getPageData(slug, lang, constants.CMS_DOMAIN, request.query);

			if (!pageData) {
				return NotFound.index(lang, request, env, ctx);
			}

			let page = pageData.page_data;

			if (!page.content) {
				return NotFound.index(lang, request, env, ctx);
			}

			page.content = JSON.parse(page.content);
			page.content = Elements.convert(page.content);

			const thisUrl = new URL(request.url);
			const pathName = thisUrl.pathname;

			let seoImage = page.seo_image || page.image || false;

			let header = Template.renderTemplate('header', {
				lang,
				menu: constants.MENU[lang],
				seo_title: page.seo_title || constants.SITE_NAME + ' - ' + constants.SITE_SLOGAN[lang],
				seo_description:
					page.seo_description || constants.SITE_NAME + ' - ' + constants.SITE_SLOGAN[lang],
				seo_image: seoImage
					? Util.generateCdnUrl(seoImage, 750, 450, 70)
					: `https://${constants.DOMAIN}/public/img/logo.svg`,
				seo_url: `https://${constants.DOMAIN}${pathName}`,
				home_url:
					lang === constants.LANGUAGES[0]
						? 'https://' + constants.DOMAIN + '/'
						: 'https://' + constants.DOMAIN + '/' + lang + '/',
				search_placeholder: constants.SEARCH.PLACEHOLDER[lang],
				search_action: constants.SEARCH.ACTION[lang],
			});

			let content = Template.renderTemplate('page_index', page);

			let replacesMap = {
				'{{sidebar}}': Template.lastPostsLoop(pageData.last_posts, lang),
				'{{pro_points_language}}': constants.PRO_POINTS_LANGUAGE[lang],
				'{{cons_points_language}}': constants.CONS_POINTS_LANGUAGE[lang],
			};

			for (let index in replacesMap) {
				content = Template.searchAndReplace(content, index, replacesMap[index]);
			}

			let footer = Template.renderTemplate('footer', {
				sitedomain: constants.DOMAIN,
				sitename: constants.SITE_NAME,
				site_description: constants.SITE_DESCRIPTION[lang],
				allrights: constants.ALL_RIGHTS[lang],
				year: new Date().getFullYear(),
				logourl: constants.LOGO_URL,
				footer_left_menu: constants.FOOTER_LEFT_MENU[lang],
				footer_left_title: constants.FOOTER_LEFT_TITLE[lang],
				footer_right_menu: constants.FOOTER_RIGHT_MENU[lang],
				footer_right_title: constants.FOOTER_RIGHT_TITLE[lang],
				footer_bottom_menu: constants.FOOTER_BOTTOM_MENU[lang],
				facebook: constants.SOCIAL_MEDIA.facebook,
				instagram: constants.SOCIAL_MEDIA.instagram,
			});

			let response = new Response(header + content + footer, {
				status: 200,
				headers: {
					'Content-Type': 'text/html',
					'Cache-Control': `public, max-age=${constants.CACHE_CONTROL_TIME}`,
				},
			});

			ctx.waitUntil(caches.default.put(request.url.split('?')[0], response.clone()));

			return response;
		} catch (e) {
			return NotFound.index(lang, request, env, ctx);
		}
	}
}

export default new Page();
