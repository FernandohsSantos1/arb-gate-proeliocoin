import { adspectRequest, credentialsFile } from './api.js';
import { streamSettings, verifyStream } from './stream.js';

const siteFile = Bun.argv[2];
if (!siteFile) throw new Error('Uso: bun experiments/setup.ts /caminho/site.json');
const site = await Bun.file(siteFile).json();
if (!/^arb-gate-(cheerstosochi|proeliocoin)$/.test(site.id) || typeof site.observe_only !== 'boolean' || typeof site.fingerprint !== 'boolean') throw new Error('Projeto de gate inválido');
const secrets = await Bun.file(credentialsFile).json();
const desired = streamSettings(site);
secrets.integration.experiments ??= {};
let streamId = secrets.integration.experiments[site.id]?.stream_id;
let created = false;
if (!streamId) {
	const matches = [];
	for (let page = 1, last = 1; page <= last; page++) {
		const response = await adspectRequest(secrets.api.token, `streams?per-page=100&page=${page}`);
		last = Number(response.headers.get('X-Pagination-Page-Count') || 1);
		matches.push(...(await response.json()).filter(stream => stream.name === desired.name));
	}
	if (matches.length > 1) throw new Error('Mais de um stream com o nome do experimento');
	if (matches.length) streamId = matches[0].stream_id;
	else {
		const stream = await (await adspectRequest(secrets.api.token, 'streams', 'POST', desired)).json();
		streamId = stream.stream_id;
		created = true;
	}
}
if (!/^[a-f0-9-]{36}$/i.test(streamId)) throw new Error('ID do stream inválido');
const actual = await (await adspectRequest(secrets.api.token, 'streams/' + streamId)).json();
verifyStream(desired, actual);
secrets.integration.experiments[site.id] = { stream_id: streamId, experiment: site.experiment, revision: site.revision };
await Bun.write(credentialsFile, JSON.stringify(secrets, null, 2) + '\n');
const localVars = new URL('.dev.vars', new URL(siteFile, 'file://' + Bun.cwd + '/'));
await Bun.write(localVars, `ADSPECT_STREAM_ID="${streamId}"\n`);
console.log(JSON.stringify({ site: site.id, created, verified: true, fingerprint: site.fingerprint,
	observe_only: site.observe_only, navigation: site.observe_only ? 'observe' : 'apply_adspect' }));
