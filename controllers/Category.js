import Template from '../models/Template';
import Requests from '../models/Requests';
import constants from '../constants';
import NotFound from './NotFound';
import Util from '../models/Util';

class Category {
async handleLang(lang, slug, page, request, env, ctx) {
    try {
        let categoryData = await Requests.getCategoryData(
            slug,            // slug da categoria
            lang,            // idioma
            constants.CMS_DOMAIN, // domínio constante
            page,            // página da requisição
            request.query    // parâmetros de consulta
        );

			if (!categoryData) {
				return NotFound.index(lang, request, env, ctx);
			}

			let category = categoryData.category_data;

			const thisUrl = new URL(request.url);
			const pathName = thisUrl.pathname;

			let seoImage = category.seo_image || category.image || false;

			let header = Template.renderTemplate('header', {
				lang,
				menu: constants.MENU[lang],
				seo_title:
					category.seo_title || constants.SITE_NAME + ' - ' + constants.SITE_SLOGAN[lang],
				seo_description:
					category.seo_description ||
					constants.SITE_NAME + ' - ' + constants.SITE_SLOGAN[lang],
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

			category.image = Util.generateCdnUrl(category.image, 750, 400, 70);
			let content = Template.renderTemplate('category_index', category);

			let replacesMap = {
				'{{sidebar}}': Template.lastPostsLoop(categoryData.last_posts, lang),
				'{{category.posts}}': Template.categoriesPostsLoop(categoryData.category_posts, lang),
				'{{pagination}}': Template.renderPagination(categoryData.pagination, lang, `c/${slug}`),
				'{{category}}': constants.CATEGORY[lang],
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
			console.log(e);
			return NotFound.index(lang, request, env, ctx);
		}
	}
}

export default new Category();
