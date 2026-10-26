const META_OFFERS_API = 'https://metaoffers.highstakes.tech/api/articles/';
const CMS_API = 'https://metacms.highstakes.tech/api/posts/get/';

export async function loadSourceArticle(entry, fetchSource = fetch) {
	const metaOffers = entry.source === 'metaoffers';
	const url = metaOffers
		? `${META_OFFERS_API}${entry.source_domain}/${encodeURIComponent(entry.slug)}`
		: `${CMS_API}${entry.lang}/${encodeURIComponent(entry.slug)}/?relateds=0`;
	const options = { signal: AbortSignal.timeout(8000), redirect: 'manual' };
	if (!metaOffers) {
		options.method = 'POST';
		options.headers = { 'Content-Type': 'application/json' };
		options.body = JSON.stringify({ domain: 'guide-flow.org' });
	}
	const response = await fetchSource(url, options);
	if (response.status === 404) return null;
	if (!response.ok) throw new Error(`Fonte editorial retornou HTTP ${response.status}`);
	const payload = await response.json();
	if (metaOffers && payload.success !== true) throw new Error('Resposta Meta Offers inválida');
	const record = metaOffers ? payload.data : payload.post_data;
	checkSourceRecord(record, entry);
	if (record.status !== 'published') return null;
	return articleFromRecord(record, entry);
}

function checkSourceRecord(record, entry) {
	if (!record || String(record.id) !== entry.source_id || record.slug !== entry.slug ||
		record.domain_name !== entry.source_domain || (record.lang || record.language) !== entry.lang) {
		throw new Error('A identidade do artigo difere do catálogo');
	}
	if (entry.source === 'metaoffers' &&
		(String(record.product_id) !== entry.product_id || String(record.offer_id) !== entry.offer_id)) {
		throw new Error('O produto ou a oferta difere do catálogo');
	}
	if (typeof record.title !== 'string' || !record.title.trim()) throw new Error('Artigo sem título');
}

function articleFromRecord(record, entry) {
	let content = record.content;
	if (entry.source === 'metacms') {
		if (typeof content === 'string') content = JSON.parse(content);
		if (!Array.isArray(content) && content && Array.isArray(content.blocks)) content = content.blocks;
		if (!Array.isArray(content) || content.length === 0) throw new Error('Conteúdo EditorJS inválido');
	} else if (!content || typeof content !== 'object' || Array.isArray(content)) {
		throw new Error('Conteúdo Meta Offers inválido');
	}
	let references = record.citations || [];
	for (let i = 0; typeof references === 'string' && i < 2; i++) references = JSON.parse(references);
	if (!Array.isArray(references)) throw new Error('Referências editoriais inválidas');
	return {
		id: String(record.id), source: entry.source, slug: record.slug, language: entry.lang,
		title: record.title, content, image: record.image, published_at: record.published_at || record.published_date,
		product_id: entry.product_id, offer_id: entry.offer_id, official_url: record.product_official_url,
		cta_text: record.cta_post, cta_landing: record.cta_landing, intro: record.top_text, references,
	};
}
