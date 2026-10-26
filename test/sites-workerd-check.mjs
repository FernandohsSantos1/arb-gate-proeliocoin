const base = new URL('../', import.meta.url);
for (const id of ['arb-gate-proeliocoin']) {
	const project = base;
	const buildLog = new URL('.artifacts/build.log', base), buildError = new URL('.artifacts/build-error.log', base);
	await Bun.write(buildLog, ''); await Bun.write(buildError, '');
	const compile = Bun.spawn(['node', 'node_modules/wrangler/bin/wrangler.js', 'deploy', '--dry-run', '--outdir', '.build'],
		{ cwd: project.pathname, stdout: Bun.file(buildLog), stderr: Bun.file(buildError),
			env: { ...Bun.env, WRANGLER_LOG_PATH: new URL('.artifacts/wrangler.log', base).pathname, WRANGLER_SEND_METRICS: 'false' } });
	const compileCode = await compile.exited;
	const compileOut = await Bun.file(buildLog).text(), compileError = await Bun.file(buildError).text();
	if (compileCode) throw new Error(compileOut + compileError);
	if (!compileOut.includes('--dry-run: exiting now.')) throw new Error('Wrangler não confirmou a compilação local');
	console.log(JSON.stringify({ site: id, stage: 'real_worker_dry_run', profile: 'real_unmodified',
		compiled: true, real_render_validated: false }));
	const directory = `/tmp/${id}-workerd-${crypto.randomUUID()}`;
	const build = await Bun.build({ entrypoints: [new URL('./sites-workerd-entry.js', import.meta.url).pathname], target: 'browser', format: 'esm', loader: { '.html': 'text' },
		plugins: [{ name: 'simulated-continuation-and-images', setup(builder) {
			builder.onResolve({ filter: /^#site$/ }, () => ({ path: 'site', namespace: 'runtime-fixture' }));
			builder.onLoad({ filter: /.*/, namespace: 'runtime-fixture' }, () => ({ contents: JSON.stringify(fixtureSite), loader: 'json' }));
			builder.onResolve({ filter: /^@site-worker$/ }, () => ({ path: new URL('index.js', project).pathname }));
			builder.onLoad({ filter: /\/content\/images\.js$/ }, () => ({ loader: 'js', contents:
				`export function articleImageUrl() { return 'https://${fixtureSite.domain}/images/fixture.png'; }\nexport function handleSharedImage() { return undefined; }` }));
		} }],
	});
	if (!build.success) throw new AggregateError(build.logs, 'Falha no runtime de ' + id);
	await Bun.write(directory + '/worker.mjs', build.outputs[0]);
	await Bun.write(directory + '/config.capnp', 'using Workerd = import "/workerd/workerd.capnp";\n' +
		'const config :Workerd.Config = (sockets = [], services = [(name = "app", worker = (' +
		'modules = [(name = "worker.mjs", esModule = embed "worker.mjs")], compatibilityDate = "2025-01-27",' +
		'globalOutbound = (name = "app", entrypoint = "upstream"), cacheApiOutbound = (name = "app", entrypoint = "cache"),' +
		'bindings = [(name = "ADSPECT_STREAM_ID", text = "00000000-0000-4000-8000-000000000001"),' +
		'(name = "ADSPECT_ROUTING_ENABLED", text = "true"), (name = "EARLY_LOADER_ENABLED", text = "true")]))]);');
	const output = new URL('.artifacts/workerd.log', base), errors = new URL('.artifacts/workerd-error.log', base);
	await Bun.write(output, ''); await Bun.write(errors, '');
	const run = Bun.spawn([new URL('node_modules/@cloudflare/workerd-linux-64/bin/workerd', base).pathname, 'test', '--experimental', directory + '/config.capnp', 'app:default'],
		{ stdout: Bun.file(output), stderr: Bun.file(errors) });
	const code = await run.exited, stdout = await Bun.file(output).text(), stderr = await Bun.file(errors).text();
	if (code) throw new Error(stdout + stderr);
	await Bun.write(new URL(`.artifacts/${id}-browser.json`, base), stdout.match(/^SITE_FIXTURES:(.+)$/m)[1]);
	console.log(stdout.match(/^SITE_OK:(.+)$/m)[1]);
}
import { fixtureSite } from './continuation-harness.js';

