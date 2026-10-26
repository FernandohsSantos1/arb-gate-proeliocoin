import Template from '../models/Template';
import Requests from '../models/Requests';
import constants from '../constants';

class Contact {
	async handleLang(lang, request, env, ctx) {
		const thisUrl = new URL(request.url);
		const pathName = thisUrl.pathname;

		let header = Template.renderTemplate('header', {
			lang,
			menu: constants.MENU[lang],
			seo_title: constants.SITE_NAME + ' - ' + constants.CONTACT_DATA.TITLE[lang],
			seo_description: constants.SITE_NAME + ' - ' + constants.CONTACT_DATA.SUBTITLE[lang],
			seo_image: `https://${constants.DOMAIN}/public/img/logo.svg`,
			seo_url: `https://${constants.DOMAIN}${pathName}`,
			home_url:
				lang === constants.LANGUAGES[0]
					? 'https://' + constants.DOMAIN + '/'
					: 'https://' + constants.DOMAIN + '/' + lang + '/',
			search_placeholder: constants.SEARCH.PLACEHOLDER[lang],
			search_action: constants.SEARCH.ACTION[lang],
		});

		let lastPosts = await Requests.getLastPosts(lang, constants.CMS_DOMAIN, request.query);

		let content = Template.get('contact_index', [
			{ search: '{title}', replace: constants.CONTACT_DATA.TITLE[lang] },
			{ search: '{subtitle}', replace: constants.CONTACT_DATA.SUBTITLE[lang] },
			{ search: '{text}', replace: constants.CONTACT_DATA.TEXT[lang] },
			{ search: '{placeholder_name}', replace: constants.CONTACT_DATA.PLACEHOLDER_NAME[lang] },
			{
				search: '{placeholder_subject}',
				replace: constants.CONTACT_DATA.PLACEHOLDER_SUBJECT[lang],
			},
			{
				search: '{placeholder_message}',
				replace: constants.CONTACT_DATA.PLACEHOLDER_MESSAGE[lang],
			},
			{ search: '{button_text}', replace: constants.CONTACT_DATA.BUTTON_TEXT[lang] },
			{ search: '{sending_message}', replace: constants.CONTACT_DATA.SENDING_MESSAGE[lang] },
			{ search: '{success_message}', replace: constants.CONTACT_DATA.SUCCESS_MESSAGE[lang] },
			{
				search: '{server_error_message}',
				replace: constants.CONTACT_DATA.SERVER_ERROR_MESSAGE[lang],
			},
			{ search: '{form_error_message}', replace: constants.CONTACT_DATA.FORM_ERROR_MESSAGE[lang] },
			{
				search: '{fill_inputs_message}',
				replace: constants.CONTACT_DATA.FILL_INPUTS_MESSAGE[lang],
			},
			{ search: '{sidebar}', replace: Template.lastPostsLoop(lastPosts, lang) },
		]);

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
	}

	async receiveMessage(request, env, ctx) {
		try {
			// Parse the incoming JSON request body
			const body = await request.json();

			// Add the domain to the request body
			body.domain = constants.DOMAIN;

			// Forward the message to the CMS endpoint
			const cmsResponse = await fetch('https://metacms.highstakes.tech/api/contact/message/', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					// If your CMS requires authentication, include the necessary headers here
					// 'Authorization': `Bearer YOUR_API_TOKEN`,
				},
				body: JSON.stringify(body),
			});

			// Check if the CMS responded with a successful status
			if (!cmsResponse.ok) {
				return new Response(
					JSON.stringify({ success: false, message: 'Failed to send message to CMS.' }),
					{
						status: cmsResponse.status,
						headers: { 'Content-Type': 'application/json' },
					}
				);
			}

			// Parse the CMS response
			const cmsData = await cmsResponse.json();

			// Return the CMS response back to the frontend
			return new Response(JSON.stringify(cmsData), {
				status: cmsResponse.status,
				headers: { 'Content-Type': 'application/json' },
			});
		} catch (error) {
			// Log the error for debugging purposes
			console.error('Error forwarding message to CMS:', error);

			// Return a generic internal server error response
			return new Response(JSON.stringify({ success: false, message: 'Internal server error.' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	}
}

export default new Contact();
