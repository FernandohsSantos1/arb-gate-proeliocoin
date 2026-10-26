import constants from '../constants.js';
import headerTemplate from '../templates/header.html' with { type: 'text' };
import footerTemplate from './footer.js';
export { siteAnalytics } from './footer.js';

function renderBlock(template, tag, values) {
	const block = template.match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`));
	if (!block) throw new Error(`Bloco ${tag} ausente no template do site.`);
	return block[0].replace(`<${tag}`, `<${tag} lang="pt"`).replace(/{{\s*([^{}]+?)\s*}}/g, (_, key) => {
		if (!Object.hasOwn(values, key)) throw new Error(`Campo ${key} ausente no layout do site.`);
		return String(values[key]);
	});
}

export function renderSiteHeader() {
	const texts = constants.HEADER.pt;
	return renderBlock(headerTemplate, 'header', {
		logo_alt: texts.LOGO_ALT,
		header_menu_label: texts.MENU_LABEL,
		header_menu_open_label: texts.MENU_OPEN_LABEL,
		header_search_label: texts.SEARCH_FORM_LABEL,
		menu: constants.MENU.pt,
		search_placeholder: constants.SEARCH.PLACEHOLDER.pt,
		search_action: constants.SEARCH.ACTION.pt,
	});
}

export function renderSiteFooter() {
	return renderBlock(footerTemplate, 'footer', {
		year: new Date().getFullYear(),
		sitename: constants.SITE_NAME,
		site_description: constants.SITE_DESCRIPTION.pt,
		footer_left_title: constants.FOOTER_LEFT_TITLE.pt,
		footer_left_menu: constants.FOOTER_LEFT_MENU.pt,
		footer_right_title: constants.FOOTER_RIGHT_TITLE.pt,
		footer_right_menu: constants.FOOTER_RIGHT_MENU.pt,
		footer_bottom_menu: constants.FOOTER_BOTTOM_MENU.pt,
	});
}
