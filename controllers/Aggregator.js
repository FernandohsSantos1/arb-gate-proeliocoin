import moment from 'moment-timezone';
import Template from '../models/Template';
import Requests from '../models/Requests';
import constants from '../constants';
import Elements from '../models/Elements';
import NotFound from './NotFound';
import Util from '../models/Util';

class Aggregator {
	async handleAggregatorLang(lang, slug, request, env, ctx) {
		try {
			// Fetch aggregator data from the CMS
			let aggregatorData = await Requests.getAggregatorData(
				lang,
				slug,
				request.query
			);

			if (!aggregatorData) {
				return NotFound.index(lang, request, env, ctx);
			}

			let aggregator = aggregatorData.aggregator_data;

			if (!aggregator) {
				return NotFound.index(lang, request, env, ctx);
			}

			// Fetch posts associated with this aggregator
			let posts = aggregatorData.posts; // Assuming the data contains associated posts

			// Prepare posts HTML
			let postsHtml = [];

			for (let post of posts) {
				// Adjust post data as needed
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

				benefitsItem = benefitsItem
					? Elements.convert(benefitsItem, 'post')
					: '';
				prosAndCons = prosAndCons
					? Elements.convert(prosAndCons, 'aggregator')
					: '';

				let postReadTime = Util.getReadTime(post.content);
				post.readtime = postReadTime;
				post.published_date_formatted = moment(
					post.published_date,
					'YYYY-MM-DD HH:mm'
				).format(constants.DATE_FORMATS[lang]);

				post.image = Util.generateCdnUrl(post.image, 728, 364, 70);

				post.post_url =
					constants.LANGUAGES[0] == lang
						? `/p/${post.slug}/`
						: `/${lang}/p/${post.slug}/`;

				post.author_url =
					constants.LANGUAGES[0] == lang
						? `/a/${post.author_slug}/`
						: `/${lang}/a/${post.author_slug}/`;

				post.category_url =
					constants.LANGUAGES[0] == lang
						? `/c/${post.category_slug}/`
						: `/${lang}/c/${post.category_slug}/`;

				post.title = post.title.split(':')[0];

				let thisPostHtml = Template.renderTemplate(
					'aggregator_post',
					post
				);

				let postReplacesMap = {
					'{{benefitsItem}}': benefitsItem,
					'{{prosAndCons}}': prosAndCons,
					'{{pro_points_language}}':
						constants.PRO_POINTS_LANGUAGE[lang],
					'{{cons_points_language}}':
						constants.CONS_POINTS_LANGUAGE[lang],
				};

				for (let index in postReplacesMap) {
					thisPostHtml = Template.searchAndReplace(
						thisPostHtml,
						index,
						postReplacesMap[index]
					);
				}

				post.destination_url =
					lang == constants.LANGUAGES[0]
						? `/p/${post.slug}/`
						: `/${lang}/p/${post.slug}/`;

				let ctaData = {
					text: post.cta_pouso,
					url: post.destination_url,
				};

				thisPostHtml = Template.insertAdsToPage(thisPostHtml);
				thisPostHtml = Template.injectCta(thisPostHtml, ctaData);

				postsHtml.push(thisPostHtml);
			}

			postsHtml = postsHtml.join('<hr>');

			// Inicializa um contador
			let hrCount = 0;

			// Substitui apenas o segundo '<hr>' por '<hr>[ad]'
			postsHtml = postsHtml.replace(/<hr>/g, function (match) {
				hrCount++;
				if (hrCount === 3) {
					return '<hr>[ad]';
				}
				return match;
			});

			const thisUrl = new URL(request.url);
			const pathName = thisUrl.pathname;

			let seoImage = aggregator.seo_image;

			seoImage = seoImage
				? Util.generateCdnUrl(seoImage, 728, 364, 70)
				: `https://${constants.DOMAIN}/public/img/logo.svg`;

			let header = Template.renderTemplate('header', {
				lang,
				menu: constants.MENU[lang],
				seo_title:
					aggregator.seo_title ||
					constants.SITE_NAME + ' - ' + constants.SITE_SLOGAN[lang],
				seo_description:
					aggregator.seo_description ||
					constants.SITE_NAME + ' - ' + constants.SITE_SLOGAN[lang],
				seo_image: seoImage,
				seo_url: `https://${constants.DOMAIN}${pathName}`,
				home_url:
					lang === constants.LANGUAGES[0]
						? 'https://' + constants.DOMAIN + '/'
						: 'https://' + constants.DOMAIN + '/' + lang + '/',
			});

			// Include any critical CSS or additional headers
			header = header.split('<!-- custom headers -->').join(
				`<link rel="preload" as="image" href="${seoImage}"><script>ENVIROMENT_CONSTANTS.SHOW_IFRAMES = false; document.querySelectorAll('.sidebar-block').forEach(el => el.classList.remove('mt-4'));</script>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-16753482859"></script>
<script>
	window.dataLayer = window.dataLayer || [];
	function gtag(){dataLayer.push(arguments);}
	gtag('js', new Date());

	gtag('config', 'AW-16753482859');
</script>`
			);

			aggregator.description = Elements.convert(
				JSON.parse(aggregator.description)
			);

			// Prepare content by rendering the aggregator template
			let content = Template.renderTemplate('aggregator_index', {
				title: aggregator.title,
				description: aggregator.description,
				posts: postsHtml,
			});

			// Replace any language-specific placeholders
			let replacesMap = {
				'{{langconfig.writtenby}}': constants.WRITTEN_BY[lang],
				'{{post_readtime}}': constants.READ_TIME[lang],
			};

			for (let index in replacesMap) {
				content = content.split(index).join(replacesMap[index]);
			}

			content = Template.insertAdsToPage(content);

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

			// Optionally cache the response
			ctx.waitUntil(
				caches.default.put(request.url.split('?')[0], response.clone())
			);

			return response;
		} catch (e) {
			console.log(e);
			return NotFound.index(lang, request, env, ctx);
		}
	}
}

export default new Aggregator();
