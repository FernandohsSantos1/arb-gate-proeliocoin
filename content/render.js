import catalog from './source-catalog.json';
import { renderSiteHeader, renderSiteFooter, siteAnalytics } from './layout.js';
import { articleImageUrl } from './images.js';
import site from '#site';

const ORIGIN = `https://${site.domain}`;
const SOURCE_HOSTS = new Set(['guide-flow.org', 'guideflow.org', 'mejorescreditos.org']);
const SOURCE_PATHS = new Map(catalog.articles.flatMap((article) => [
	[article.canonical_path, article.canonical_path],
	...article.source_paths.map((path) => [path, article.source === 'metacms' ? article.canonical_path : path]),
]));
const INLINE_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'br', 'code', 'sub', 'sup', 'span', 'p', 'ul', 'ol', 'li']);
const SECTIONS = [
	'introduction', 'free_topic_1', 'benefits', 'free_topic_2', 'target_audience',
	'free_topic_3', 'pros_and_cons', 'free_topic_4', 'why_we_recommend', 'free_topic_5',
	'how_to_apply', 'free_topic_6', 'faq', 'free_topic_7', 'final_considerations',
];
const LABELS = {
	pt: { home: 'Início', read: 'Ler o artigo completo', official: 'Acessar o site oficial', pros: 'Pontos positivos', cons: 'Pontos negativos', references: 'Referências', published: 'Publicado em', locale: 'pt-BR' },
	en: { home: 'Home', read: 'Read the full article', official: 'Visit the official website', pros: 'Pros', cons: 'Cons', references: 'References', published: 'Published on', locale: 'en' },
	es: { home: 'Inicio', read: 'Leer el artículo completo', official: 'Visitar el sitio oficial', pros: 'Ventajas', cons: 'Desventajas', references: 'Referencias', published: 'Publicado el', locale: 'es' },
	fr: { home: 'Accueil', read: "Lire l’article complet", official: 'Consulter le site officiel', pros: 'Avantages', cons: 'Inconvénients', references: 'Références', published: 'Publié le', locale: 'fr' },
};

function brandText(value) {
	if (typeof value !== 'string') throw new TypeError('Conteúdo editorial inválido: texto esperado.');
	return value.replace(/\b(?:www\.)?(?:guide-?flow\.org|mejorescreditos\.org)\b/gi, site.domain)
		.replace(/\b(?:Guide[\s-]*Flow|Mejores\s+Cr[eé]ditos)\b/gi, site.name);
}

function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function linkUrl(value) {
	if (typeof value !== 'string') return null;
	const entities = { amp: '&', quot: '"', apos: "'", colon: ':', Tab: '\t', NewLine: '\n' };
	const decoded = value.trim().replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|colon|Tab|NewLine);/gi, (match, entity) => {
		if (entity[0] !== '#') return entities[entity] || match;
		const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
		return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
	});
	if (!/^(?:https?:\/\/|\/(?!\/)|#|mailto:)/i.test(decoded)) return null;
	if (decoded.startsWith('#')) return decoded;
	try {
		const url = new URL(decoded, ORIGIN);
		if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) return null;
		if (SOURCE_HOSTS.has(url.hostname.replace(/^www\./, ''))) {
			const path = url.pathname === '/' ? '/' : SOURCE_PATHS.get(url.pathname.replace(/\/?$/, '/'));
			if (path) return `${ORIGIN}${path}${url.search}${url.hash}`;
		}
		return url.origin === ORIGIN ? `${url.pathname}${url.search}${url.hash}` : url.href;
	} catch {
		return null;
	}
}

function inlineTag(token) {
	const match = token.match(/^<\s*(\/?)\s*([a-z][a-z0-9]*)\b[^>]*>$/i);
	if (!match) return escapeHtml(token);
	const tag = match[2].toLowerCase();
	if (tag === 'a') {
		if (match[1]) return '</a>';
		const attribute = token.match(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
		const href = attribute && linkUrl(attribute[1] ?? attribute[2] ?? attribute[3]);
		return href ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer">` : '';
	}
	if (!INLINE_TAGS.has(tag)) return '';
	return tag === 'br' ? '<br>' : `<${match[1]}${tag}>`;
}

function editorialHtml(value) {
	if (typeof value !== 'string') throw new TypeError('Conteúdo editorial inválido: texto esperado.');
	const clean = value.replace(/\[(?:ad|cta|related)\]/gi, '')
		.replace(/<(script|style|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
	return (clean.match(/<[^>]*>|[^<]+|</g) || []).map((token) => {
		if (token.startsWith('<')) return inlineTag(token);
		return escapeHtml(brandText(token)).replace(/&amp;((?:#\d+|#x[\da-f]+|[a-z][a-z0-9]+);)/gi, '&$1');
	}).join('');
}

function paragraph(value) {
	const html = editorialHtml(value);
	return html.trim() ? `<p>${html}</p>` : '';
}

function list(items, ordered = false) {
	if (!Array.isArray(items)) throw new TypeError('Conteúdo editorial inválido: lista esperada.');
	if (!items.length) return '';
	const tag = ordered ? 'ol' : 'ul';
	const entries = items.map((item) => {
		if (typeof item === 'string') return `<li>${editorialHtml(item)}</li>`;
		if (!item || typeof item.content !== 'string') throw new TypeError('Item editorial inválido.');
		const nested = item.items === undefined ? '' : list(item.items, ordered);
		return `<li>${editorialHtml(item.content)}${nested}</li>`;
	}).join('');
	return `<${tag}>${entries}</${tag}>`;
}

function descriptions(items, titleKey = 'title') {
	if (!Array.isArray(items)) throw new TypeError('Conteúdo editorial inválido: lista descritiva esperada.');
	return `<ul class="shared-descriptions">${items.map((item) => `<li><strong>${editorialHtml(item[titleKey])}</strong>${paragraph(item.description)}</li>`).join('')}</ul>`;
}

function table(headings, rows) {
	const head = headings.length ? `<thead><tr>${headings.map((title) => `<th scope="col">${editorialHtml(title)}</th>`).join('')}</tr></thead>` : '';
	return `<div class="shared-table"><table>${head}<tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${editorialHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function imageFigure(source, caption = '', hero = false) {
	const url = linkUrl(source);
	if (!url || url.startsWith('mailto:')) throw new TypeError('Conteúdo editorial inválido: URL de imagem inválida.');
	const alt = escapeHtml(brandText(caption.replace(/<[^>]*>/g, '')));
	return `<figure class="${hero ? 'shared-hero' : 'shared-image'}"><img src="${escapeHtml(url)}" alt="${alt}" ${hero ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">${!hero && caption ? `<figcaption>${editorialHtml(caption)}</figcaption>` : ''}</figure>`;
}

function officialLink(article, label) {
	const url = linkUrl(article.official_url);
	return url && !url.startsWith('mailto:') ? `<p class="shared-actions"><a class="shared-button" href="${escapeHtml(url)}" rel="noopener noreferrer">${escapeHtml(brandText(label))}</a></p>` : '';
}

function metaField(key, value, article, labels) {
	if (key === 'section_title') return `<h2>${editorialHtml(value)}</h2>`;
	if (['paragraph', 'intro_paragraph', 'concluding_paragraph'].includes(key)) return paragraph(value);
	if (key === 'paragraphs') {
		if (!Array.isArray(value)) throw new TypeError('Conteúdo editorial inválido: lista de parágrafos esperada.');
		return value.map(paragraph).join('');
	}
	if (['list', 'unordered_list', 'ordered_list', 'contacts'].includes(key)) return list(value, key === 'ordered_list');
	if (key === 'benefits_list') return descriptions(value);
	if (key === 'pros' || key === 'cons') return `<h3>${labels[key]}</h3>${descriptions(value)}`;
	if (key === 'button') return officialLink(article, value || article.cta_text || labels.official);
	if (key === 'items') return value.map((item) => `<div class="shared-faq"><h3>${editorialHtml(item.question)}</h3>${paragraph(item.answer)}${item.bullets === undefined ? '' : list(item.bullets)}</div>`).join('');
	throw new TypeError(`Campo editorial Meta Offers não suportado: ${key}.`);
}

function metaSection(section, article, labels) {
	if (!section || typeof section !== 'object' || Array.isArray(section)) throw new TypeError('Seção Meta Offers inválida.');
	return `<section>${Object.entries(section).map(([key, value]) => metaField(key, value, article, labels)).join('')}</section>`;
}

function metaArticle(article, labels) {
	const content = article.content;
	if (!content || typeof content !== 'object' || Array.isArray(content)) throw new TypeError('Conteúdo Meta Offers inválido: objeto de seções esperado.');
	for (const key of Object.keys(content)) {
		if (key !== 'title' && !SECTIONS.includes(key)) throw new TypeError(`Seção Meta Offers não suportada: ${key}.`);
	}
	if (!content.introduction) throw new TypeError('Conteúdo Meta Offers inválido: introdução ausente.');
	return SECTIONS.filter((key) => key in content).map((key) => metaSection(content[key], article, labels)).join('');
}

function editorBlock(block, labels) {
	if (!block || !block.data) throw new TypeError('Bloco EditorJS inválido.');
	const data = block.data;
	switch (block.type) {
		case 'paragraph': return paragraph(data.text);
		case 'header': {
			if (!Number.isInteger(data.level) || data.level < 1 || data.level > 6) throw new TypeError('Nível de cabeçalho EditorJS inválido.');
			const level = Math.max(2, data.level);
			return `<h${level}>${editorialHtml(data.text)}</h${level}>`;
		}
		case 'list': return list(data.items, data.style === 'ordered');
		case 'quote': return `<blockquote>${paragraph(data.text)}${data.caption ? `<cite>${editorialHtml(data.caption)}</cite>` : ''}</blockquote>`;
		case 'image': return imageFigure(data.file?.url || data.url, data.caption || '');
		case 'delimiter': return '<hr>';
		case 'proConList': return `<section><h2>${editorialHtml(data.sectionTitlePros || labels.pros)}</h2>${descriptions(data.pros)}<h2>${editorialHtml(data.sectionTitleCons || labels.cons)}</h2>${descriptions(data.cons)}</section>`;
		case 'benefitsList': return `<section>${data.sectionTitle ? `<h2>${editorialHtml(data.sectionTitle)}</h2>` : ''}${descriptions(data.items, 'name')}</section>`;
		case 'proConTable': return table([data.sectionTitlePros || labels.pros, data.sectionTitleCons || labels.cons], data.items.map((item) => [item.pro, item.con]));
		case 'benefitsTable': return `<section>${data.title ? `<h2>${editorialHtml(data.title)}</h2>` : ''}${table([], data.items.map((item) => [item.name, item.description]))}</section>`;
		default: throw new TypeError(`Tipo de bloco EditorJS não suportado: ${block.type}.`);
	}
}

function cmsArticle(content, labels) {
	if (Array.isArray(content) && content.length) return content.map((block) => editorBlock(block, labels)).join('');
	throw new TypeError('Conteúdo MetaCMS inválido: lista de blocos EditorJS esperada.');
}

function landing(article, canonicalPath, labels) {
	let intro = typeof article.intro === 'string' && article.intro.trim() ? paragraph(article.intro) : '';
	if (!intro && article.source === 'metaoffers') intro = metaSection(article.content.introduction, article, labels);
	if (!intro && Array.isArray(article.content)) {
		const first = article.content.find((block) => block.type === 'paragraph' && paragraph(block.data.text));
		if (first) intro = paragraph(first.data.text);
	}
	if (!intro.replace(/<[^>]*>/g, '').trim()) throw new TypeError('Conteúdo editorial inválido: introdução ausente na página de entrada.');
	if (article.source === 'metaoffers' && (typeof article.slug !== 'string' || !article.slug.trim())) throw new TypeError('Slug do artigo Meta Offers ausente.');
	const path = article.source === 'metaoffers' ? `/e/${encodeURIComponent(article.slug)}/` : canonicalPath;
	const label = typeof article.cta_landing === 'string' && article.cta_landing.trim() ? article.cta_landing : labels.read;
	const cta = `<p class="shared-actions"><a class="shared-button shared-landing-cta" data-clickverso-open-modal href="${escapeHtml(path)}">${editorialHtml(label)}<span aria-hidden="true">→</span></a></p>`;
	const image = article.image ? imageFigure(articleImageUrl(article), article.title, true) : '';
	return `<div class="shared-landing-intro">${intro}</div>${cta}${image}${landingHighlights(article, labels, cta)}
<p class="shared-landing-reading"><a data-clickverso-read-article href="${escapeHtml(path)}">${labels.read}</a></p>`;
}

function landingHighlights(article, labels, cta) {
	if (article.source !== 'metaoffers') return '';
	// Guideflow: money.js handleAliasLanding + vendor-money/helpers/contentTemplates/pageSequences.js.
	const benefits = article.content.benefits;
	const pros = article.content.pros_and_cons?.pros;
	const benefitBody = benefits ? Object.entries(benefits).filter(([key]) => key !== 'section_title')
		.map(([key, value]) => metaField(key, value, article, labels)).join('') : '';
	const benefitSection = benefitBody ? `<section class="shared-landing-benefits">${benefitBody}</section>${cta}` : '';
	const prosSection = pros?.length ? `<section class="shared-landing-pros"><h2>${labels.pros}</h2>${descriptions(pros)}</section>${cta}` : '';
	return benefitSection + prosSection;
}

function references(urls, labels) {
	if (urls === undefined || urls === null) return '';
	if (!Array.isArray(urls)) throw new TypeError('Referências inválidas: lista de URLs esperada.');
	const links = urls.map((value) => {
		const url = linkUrl(value);
		if (!url) throw new TypeError('Referência editorial com URL inválida.');
		return `<li><a href="${escapeHtml(url)}" rel="noopener noreferrer">${escapeHtml(new URL(url, ORIGIN).href)}</a></li>`;
	});
	return links.length ? `<section class="shared-references"><h2>${labels.references}</h2><ul>${links.join('')}</ul></section>` : '';
}

function publishedDate(value, labels) {
	if (!value) return '';
	const date = new Date(value);
	if (Number.isNaN(date.valueOf())) throw new TypeError('Data de publicação editorial inválida.');
	const display = new Intl.DateTimeFormat(labels.locale, { dateStyle: 'long', timeZone: 'UTC' }).format(date);
	return `<time datetime="${date.toISOString()}">${labels.published} ${escapeHtml(display)}</time>`;
}

function documentHtml(article, canonicalPath, body, labels, format) {
	const title = escapeHtml(brandText(article.title));
	const canonical = escapeHtml(new URL(canonicalPath, ORIGIN).href);
	const image = article.image ? articleImageUrl(article) : null;
	const socialImage = image ? `<meta property="og:image" content="${escapeHtml(articleImageUrl(article, true))}"><meta property="og:image:alt" content="${title}">` : '';
	const isLanding = format === 'landing';
	return `<!DOCTYPE html>
<html lang="${article.language}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} | ${escapeHtml(site.name)}</title><link rel="canonical" href="${canonical}"><meta property="og:title" content="${title}"><meta property="og:url" content="${canonical}"><meta property="og:type" content="article">${socialImage}
<link rel="stylesheet" href="/public/css/index.css"><link rel="stylesheet" href="/public/css/shared-article.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Ubuntu+Sans:ital,wght@0,100..800;1,100..800&amp;display=swap">
${siteAnalytics}
</head><body class="shared-page${isLanding ? ' shared-landing' : ''}">${renderSiteHeader()}
<main class="shared-main"><article class="shared-article"><header class="shared-article-header"><h1>${title}</h1>${isLanding ? '' : publishedDate(article.published_at, labels)}</header>
${image && !isLanding ? imageFigure(image, article.title, true) : ''}<div class="shared-content">${body}</div></article></main>
${renderSiteFooter()}<div class="mobile-overlay"></div><script src="/public/js/shared-navigation.js" defer></script></body></html>`;
}

export function renderSharedArticle(article, canonicalPath, format = 'article') {
	if (!article || !['metaoffers', 'metacms'].includes(article.source)) throw new TypeError('Fonte editorial inválida.');
	if (typeof article.title !== 'string' || !article.title.trim()) throw new TypeError('Título editorial ausente.');
	if (!Object.hasOwn(LABELS, article.language)) throw new TypeError(`Idioma editorial não suportado: ${article.language}.`);
	if (typeof canonicalPath !== 'string' || !/^\/(?!\/)/.test(canonicalPath) || new URL(canonicalPath, ORIGIN).origin !== ORIGIN) throw new TypeError('Caminho canônico inválido.');
	if (!['article', 'landing'].includes(format)) throw new TypeError(`Formato editorial não suportado: ${format}.`);
	const labels = LABELS[article.language];
	let body = format === 'landing' ? landing(article, canonicalPath, labels)
		: article.source === 'metaoffers' ? metaArticle(article, labels) : cmsArticle(article.content, labels);
	if (!body.replace(/<[^>]*>/g, '').trim()) throw new TypeError('Conteúdo editorial vazio.');
	if (format === 'article') body += references(article.references, labels);
	return documentHtml(article, canonicalPath, body, labels, format);
}
