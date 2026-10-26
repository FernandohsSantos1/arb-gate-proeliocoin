export function sourceSnapshot(entry) {
	const folder = entry.source === 'metaoffers' ? (entry.source_domain === 'mejorescreditos.org' ? 'metaoffers-articles' : `metaoffers-pilot/${entry.source_domain}`) : 'metacms-original-posts';
	return Bun.file(new URL(`./fixtures/content/${folder}/${entry.slug}.json`, import.meta.url));
}
