let isMenuOpen = false;
$('#js-menu-toggle').on('click', () => {
	if (isMenuOpen) {
		$('body').removeClass('js-mobile-menu-opened');
		isMenuOpen = false;
	} else {
		$('body').addClass('js-mobile-menu-opened');
		isMenuOpen = true;
	}
});

const url = new URL(window.location.href);
const links = document.getElementsByTagName('a');
const medium = url.searchParams.get('utm_medium');
const campaign = url.searchParams.get('utm_campaign');
const source = url.searchParams.get('utm_source');
const term = url.searchParams.get('utm_term');

let attrs = {};

if (source) attrs.source = source;

if (campaign) attrs.campaign = campaign;

if (medium) attrs.medium = medium;

if (term) attrs.country = term;

for (let link of links) {
	for (let attr in attrs) {
		if (!link.href.includes('?')) {
			link.href = link.href + '?';
		} else {
			link.href = link.href + '&';
		}

		if (attr == 'country') {
			link.href += `utm_term=${attrs[attr]}`;
		} else {
			link.href += `utm_${attr}=${attrs[attr]}`;
		}
	}
}
