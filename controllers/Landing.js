import moment from 'moment-timezone';
import Template from '../models/Template';
import Requests from '../models/Requests';
import constants from '../constants';
import Elements from '../models/Elements';
import NotFound from './NotFound';
import Util from '../models/Util';

class Landing {
	async handleLang(lang, slug, request, env, ctx) {
		try {
			let postData = await Requests.getLandingData(slug, lang, constants.CMS_DOMAIN, request.query);

			if (!postData) {
				return NotFound.index(lang, request, env, ctx);
			}

			let post = postData.post_data;

			if (!post.content) {
				return NotFound.index(lang, request, env, ctx);
			}

			if (post.type_id == 4) {
				return Response.redirect(request.url.replace('/l/', '/p/'), 301);
			}

			post.content = JSON.parse(post.content);

			let benefitsItem = false;
			let prosAndCons = false;

			for (let each of post.content) {
				if (each.type == 'benefitsList') {
					benefitsItem = [each];
				} else if (each.type == 'proConList') {
					prosAndCons = [each];
				}
			}

			benefitsItem = benefitsItem ? Elements.convert(benefitsItem, 'post') : '';
			prosAndCons = prosAndCons ? Elements.convert(prosAndCons, 'lander') : '';

			const thisUrl = new URL(request.url);
			const pathName = thisUrl.pathname;

			let seoImage = post.seo_image || post.image || false;

			let header = Template.renderTemplate('header', {
				lang,
				menu: constants.MENU[lang],
				seo_title: post.seo_title || constants.SITE_NAME + ' - ' + constants.SITE_SLOGAN[lang],
				seo_description:
					post.seo_description || constants.SITE_NAME + ' - ' + constants.SITE_SLOGAN[lang],
				seo_image: seoImage
					? Util.generateCdnUrl(seoImage, 728, 364, 70)
					: `https://${constants.DOMAIN}/public/img/logo.svg`,
				seo_url: `https://${constants.DOMAIN}${pathName}`,
				home_url:
					lang === constants.LANGUAGES[0]
						? 'https://' + constants.DOMAIN + '/'
						: 'https://' + constants.DOMAIN + '/' + lang + '/',
				search_placeholder: constants.SEARCH.PLACEHOLDER[lang],
				search_action: constants.SEARCH.ACTION[lang],
			});

			post.image = Util.generateCdnUrl(post.image, 728, 364, 70);

			header = header.split('<!-- custom headers -->').join(
				`<link rel="preload" as="image" href="${post.image}"><script>ENVIROMENT_CONSTANTS.SHOW_IFRAMES = false; document.querySelectorAll('.sidebar-block').forEach(el => el.classList.remove('mt-4'));</script>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-16753482859"></script>
<script>
	window.dataLayer = window.dataLayer || [];
	function gtag(){dataLayer.push(arguments);}
	gtag('js', new Date());

	gtag('config', 'AW-16753482859');
</script>`
			);

			post.category_url =
				constants.LANGUAGES[0] == lang
					? `/c/${post.category_slug}/`
					: `/${lang}/c/${post.category_slug}/`;

			post.title = post.title.includes(':') ? post.title.split(':')[0] : post.title;

			post.published_date = moment(post.published_date, 'YYYY-MM-DD HH:mm').format(
				constants.DATE_FORMATS[lang]
			);

			let content = Template.renderTemplate('landing_index', post);

			let replacesMap = {
				'{{benefitsItem}}': benefitsItem,
				'{{prosAndCons}}': prosAndCons,
				'{{pro_points_language}}': constants.PRO_POINTS_LANGUAGE[lang],
				'{{cons_points_language}}': constants.CONS_POINTS_LANGUAGE[lang],
				'review-style1': 'review-style5',
			};

			for (let index in replacesMap) {
				content = Template.searchAndReplace(content, index, replacesMap[index]);
			}

			post.destination_url =
				lang == constants.LANGUAGES[0] ? `/p/${post.slug}/` : `/${lang}/p/${post.slug}/`;

			let ctaData = {
				text: post.cta_pouso,
				url: post.destination_url,
			};

			content = Template.insertAdsToPage(content);
			content = Template.injectCta(content, ctaData);

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
				preloader_text: constants.PRELOADER.LOADING[lang],
				secure_text: constants.PRELOADER.SECURE[lang],
			});

			footer = footer.split('<!-- custom scripts -->').join(`<script>
document.addEventListener('DOMContentLoaded', function () {
	const conversionLinks = document.querySelectorAll('a.thecta.pulse');

	conversionLinks.forEach(function (link) {
		link.addEventListener('click', function () {
			const params = new URLSearchParams(window.location.search);

			if (params.get('utm_source') === 'google') {
				gtag('event', 'conversion', {
					send_to: 'AW-16753482859/qhw8COujw-MZEOu417Q-',
				});
			}
		});
	});
});
</script>`);

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

export default new Landing();
