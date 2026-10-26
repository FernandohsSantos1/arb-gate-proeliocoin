import site from '../site.json';

export const fixtureCopy = { title: 'Título somente da fixture', description: 'Descrição somente da fixture; continuação para parceiro de teste.',
	open: 'Abrir parceiro da fixture', continue: 'Continuar fixture', close: 'Fechar fixture', loading: 'Consulta da fixture', error: 'Falha da fixture' };
export const fixtureSite = { ...site, name: 'Nome técnico da fixture B27', observe_only: false,
	continuation: { pt: fixtureCopy, en: fixtureCopy, es: fixtureCopy } };

// Configuração e imagens simuladas: este helper não valida a identidade nem as capas reais do B.
export async function continuationWorker(configuration = fixtureSite) {
	const root = new URL('../', import.meta.url);
	const build = await Bun.build({ entrypoints: [new URL('index.js', root).pathname], target: 'browser', format: 'esm', loader: { '.html': 'text' },
		plugins: [{ name: 'continuation-fixture', setup(builder) {
			builder.onResolve({ filter: /^#site$/ }, () => ({ path: 'site', namespace: 'continuation-fixture' }));
			builder.onLoad({ filter: /.*/, namespace: 'continuation-fixture' }, () => ({ contents: JSON.stringify(configuration), loader: 'json' }));
			builder.onLoad({ filter: /\/content\/images\.js$/ }, () => ({ loader: 'js', contents:
				`export function articleImageUrl() { return 'https://${configuration.domain}/images/fixture.png'; }\nexport function handleSharedImage() { return undefined; }` }));
		} }],
	});
	if (!build.success) throw new AggregateError(build.logs, 'Falha na compilação da fixture B27');
	const file = `/tmp/continuation-fixture-${crypto.randomUUID()}.mjs`;
	await Bun.write(file, build.outputs[0]);
	try { return (await import(file)).default; }
	finally { await Bun.file(file).delete(); }
}
