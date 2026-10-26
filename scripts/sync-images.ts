import sharp from 'sharp';
import site from '../site.json';

const root = `${import.meta.dir}/..`;
const temporary = `/tmp/${site.id}-images-${crypto.randomUUID()}`;
const catalogBytes = await Bun.file(`${root}/content/source-catalog.json`).bytes();
const catalog = JSON.parse(new TextDecoder().decode(catalogBytes));
const articles = catalog.articles.filter((article: any) => article.source === 'metaoffers');
if (!articles.length) throw new Error('O catálogo não contém capas Meta Offers.');

const images = articles.map((article: any) => {
	const url = new URL(article.image);
	const filename = url.pathname.split('/').pop();
	if (typeof article.source_id !== 'string' || !/^\d+$/.test(article.source_id) ||
		!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(article.source_domain) ||
		url.origin !== 'https://meta-offers-images.highstakes.tech' || url.username || url.password ||
		url.pathname !== `/${article.source_domain}/${filename}` || url.search || url.hash ||
		!filename || !/^[a-zA-Z0-9._-]+\.(png|jpe?g)$/.test(filename)) {
		throw new Error(`Origem de imagem inválida: ${article.slug}.`);
	}
	return { source: 'metaoffers', source_domain: article.source_domain, source_id: article.source_id, slug: article.slug,
		source_url: article.image, filename, post_path: `/images/post/${filename}`, thumb_path: `/images/thumb/${filename}` };
});
if (new Set(images.map((item: any) => item.filename)).size !== articles.length) throw new Error('Nomes de arquivo de imagem duplicados.');
const python = Bun.spawnSync(['python3', '-c', 'from PIL import Image; print(Image.__version__)']);
if (python.exitCode !== 0) throw new Error(`Pillow indisponível: ${new TextDecoder().decode(python.stderr)}`);

const logoFile = 'public/img/logo.svg';
const logoBytes = await Bun.file(`${root}/${logoFile}`).bytes();
const logoInfo = await sharp(logoBytes).metadata();
const logo = await sharp(logoBytes).resize({ width: 1200 }).png().toBuffer({ resolveWithObject: true });
if (!logoInfo.width || !logoInfo.height || logo.info.height !== Math.round(1200 * logoInfo.height / logoInfo.width)) {
	throw new Error('A rasterização alterou a proporção da logo.');
}
await Bun.write(`${temporary}/logo.png`, logo.data, { createPath: true });

async function download(item: any) {
	const response = await fetch(item.source_url, { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
	if (response.status !== 200 || !/^image\/(png|jpeg)(?:;|$)/.test(response.headers.get('content-type') || '')) {
		await response.body?.cancel();
		throw new Error(`${item.filename}: HTTP ${response.status} ou tipo de conteúdo inválido.`);
	}
	const bytes = await response.bytes();
	if (!bytes.length) throw new Error(`${item.filename}: imagem vazia.`);
	await Bun.write(`${temporary}/originals/${item.filename}`, bytes, { createPath: true });
}

let next = 0;
let completed = 0;
const errors: string[] = [];
console.log(JSON.stringify({ stage: 'download', total: images.length, concurrency: 4, temporary }));
await Promise.all(Array.from({ length: 4 }, async () => {
	while (next < images.length) {
		const item = images[next++];
		try { await download(item); }
		catch (error: any) { errors.push(`${item.filename}: ${error.message}`); }
		completed++;
		if (completed % 10 === 0 || completed === images.length) console.log(JSON.stringify({ stage: 'download', completed, failed: errors.length }));
	}
}));
if (errors.length) throw new Error(`Falha em ${errors.length} imagens. Nenhuma saída publicada.\n${errors.join('\n')}`);

await Bun.write(`${temporary}/job.json`, JSON.stringify(images));
const processor = Bun.spawn(['python3', `${import.meta.dir}/swap-image-badges.py`, temporary], { stdout: 'inherit', stderr: 'inherit' });
if (await processor.exited !== 0) throw new Error('Falha ao processar as capas. Nenhuma saída publicada.');
const processed = await Bun.file(`${temporary}/result.json`).json();
if (processed.length !== articles.length) throw new Error('O processamento não produziu todas as capas do catálogo.');
for (const item of processed) {
	if (item.post.width > 800 || item.thumb.width !== 300 || item.thumb.height !== 225) throw new Error(`Dimensões inválidas: ${item.filename}.`);
	for (const kind of ['post', 'thumb']) {
		const bytes = await Bun.file(`${temporary}/${kind}/${item.filename}`).bytes();
		if (new Bun.CryptoHasher('sha256').update(bytes).digest('hex') !== item[kind].sha256) throw new Error(`Hash inválido: ${kind}/${item.filename}.`);
		await Bun.write(`${root}/public/img/money/${kind}/${item.filename}`, bytes, { createPath: true });
	}
}

const summary = { total: processed.length, badge_replaced: processed.filter((item: any) => item.badge_replaced).length,
	without_badge: processed.filter((item: any) => !item.badge_replaced).length };
const manifest = {
	schema_version: 1, generated_at: new Date().toISOString(), brand: site.name,
	catalog_sha256: new Bun.CryptoHasher('sha256').update(catalogBytes).digest('hex'),
	logo: { source_file: logoFile, sha256: new Bun.CryptoHasher('sha256').update(logoBytes).digest('hex'),
		width: logoInfo.width, height: logoInfo.height, raster_width: logo.info.width, raster_height: logo.info.height },
	processing: { algorithm: 'guideflow-badge-swap-v1', sharp: sharp.versions.sharp,
		pillow: new TextDecoder().decode(python.stdout).trim(),
		script_sha256: new Bun.CryptoHasher('sha256').update(await Bun.file(`${import.meta.dir}/swap-image-badges.py`).bytes()).digest('hex') },
	summary, images: processed,
};
await Bun.write(`${root}/content/image-manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ stage: 'complete', manifest: 'content/image-manifest.json', temporary, ...summary }));
