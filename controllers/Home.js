import Template from '../models/Template';
import Requests from '../models/Requests';
import constants from '../constants';
import Util from '../models/Util';
import moment from 'moment-timezone';

function renderTopPostsItem(post, lang) {
	let url = constants.LANGUAGES[0] == lang ? `/p/${post.slug}/` : `/${lang}/p/${post.slug}/`;
	let image = Util.generateCdnUrl(post.image, 360, 220, 70);
	let post_date = moment(post.published_date, 'YYYY-MM-DD HH:mm').format(constants.DATE_FORMATS[lang]);

	return Template.renderTemplate('home_top_posts_item', {
		url, post_url: url, image, title: post.title,
		category_url: `/c/${post.category?.slug || 'geral'}/`, category_name: post.category?.name || 'Geral',
		post_date, post_readtime: `${post.read_time || 5} min de leitura`,
	});
}

function renderTopPosts(topPosts, lang) {
	if (!topPosts || topPosts.length === 0) return '';

	let mainPost = topPosts[0];
	let items = topPosts.slice(1).map(post => renderTopPostsItem(post, lang)).join('');

	let url = constants.LANGUAGES[0] == lang ? `/p/${mainPost.slug}/` : `/${lang}/p/${mainPost.slug}/`;
	let image = Util.generateCdnUrl(mainPost.image, 750, 470, 70);
	let post_date = moment(mainPost.published_date, 'YYYY-MM-DD HH:mm').format(constants.DATE_FORMATS[lang]);

	return Template.renderTemplate('home_top_posts', {
		url, post_url: url, image, title: mainPost.title,
		category_url: `/c/${mainPost.category?.slug || 'geral'}/`, category_name: mainPost.category?.name || 'Geral',
		post_date, post_readtime: `${mainPost.read_time || 10} min de leitura`,
		items,
	});
}

function renderCategoryItem(post, lang) {
	let url = constants.LANGUAGES[0] == lang ? `/p/${post.slug}/` : `/${lang}/p/${post.slug}/`;
	let image = Util.generateCdnUrl(post.image, 128, 104, 70);
	let post_date = moment(post.published_date, 'YYYY-MM-DD HH:mm').format(constants.DATE_FORMATS[lang]);

	return Template.renderTemplate('home_category_item', {
		url, post_url: url, image, title: post.title,
		category_url: `/c/${post.category?.slug || 'geral'}/`, category_name: post.category?.name || 'Geral',
		post_date, post_readtime: `${post.read_time || 5} min de leitura`,
	});
}

function renderCategory(category, lang) {
	if (!category.posts || category.posts.length === 0) return '';
	
	let mainPost = category.posts[0];
	let items = category.posts.slice(1).map(post => renderCategoryItem(post, lang)).join('');
	
	let url = constants.LANGUAGES[0] == lang ? `/p/${mainPost.slug}/` : `/${lang}/p/${mainPost.slug}/`;
	let image = Util.generateCdnUrl(mainPost.image, 555, 336, 70);
	let post_date = moment(mainPost.published_date, 'YYYY-MM-DD HH:mm').format(constants.DATE_FORMATS[lang]);
	
	return Template.renderTemplate('home_category', {
		category_name: category.name, category_url: `/c/${category.slug}/`,
		url, post_url: url, image, title: mainPost.title,
		post_date, post_readtime: `${mainPost.read_time || 10} min de leitura`,
		items,
	});
}

class Home {
	async handleHomeLang(lang, request, env, ctx) {
		try {
			let homeData = await Requests.getHomeData(lang, constants.CMS_DOMAIN, request.query);

			if (!homeData) {
				throw new Error('Conteúdo da home indisponível');
			}

			let header = Template.renderTemplate('header', {
				lang,
				menu: constants.MENU[lang],
				seo_title: constants.SITE_NAME + ' - ' + constants.SITE_SLOGAN[lang],
				seo_description: constants.SITE_NAME + ' - ' + constants.SITE_SLOGAN[lang],
				seo_image: `https://${constants.DOMAIN}/public/img/logo.svg`,
				seo_url: 'https://' + constants.DOMAIN + '/',
				home_url: `https://${constants.DOMAIN}/`,
				search_placeholder: constants.SEARCH.PLACEHOLDER[lang],
				search_action: constants.SEARCH.ACTION[lang],
				logo_alt: constants.HEADER.pt.LOGO_ALT,
				header_menu_label: constants.HEADER.pt.MENU_LABEL,
				header_search_label: constants.HEADER.pt.SEARCH_FORM_LABEL,
			});

			let topPostsHtml = renderTopPosts(homeData.top_posts || [], lang);
			let categoriesHtml = (homeData.categories || []).map(cat => renderCategory(cat, lang)).join('');

			let content = `<main class="main-content-area"><div class="container"><div class="row">${topPostsHtml}${categoriesHtml}</div></div></main>`;

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

			let homePageContent = header + content + footer;

			let response = new Response(homePageContent, {
				status: 200,
				headers: {
					'Content-Type': 'text/html',
					'Cache-Control': `public, max-age=${constants.CACHE_CONTROL_TIME}`,
				},
			});

			return response;
		} catch (e) {
			console.error('Falha ao carregar home:', e.message, e.stack);
			return new Response('Erro: ' + e.message, {
				status: 503,
				headers: {
					'Content-Type': 'text/plain; charset=utf-8',
					'Cache-Control': 'no-store',
				},
			});
		}
	}
}

export default new Home();
