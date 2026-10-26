import { adspectRequest, credentialsFile } from './api.js';
import { metrics, reportRows, summarize } from './report.js';

const [from, to] = Bun.argv.slice(2);
if (!Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to)) || Date.parse(from) >= Date.parse(to)) throw new Error('Informe início e fim em ISO 8601, nesta ordem');
const secrets = await Bun.file(credentialsFile).json();
const comparison = [];
for (const site of ['arb-gate-cheerstosochi', 'arb-gate-proeliocoin']) {
	const setup = secrets.integration.experiments?.[site];
	if (!setup) throw new Error(`Execute o setup de ${site}`);
	const query = new URLSearchParams({ date_from: from, date_to: to, time_zone: 'UTC' });
	query.set('stream_id[]', setup.stream_id);
	for (const metric of metrics) query.append('metrics[]', metric);
	const response = await adspectRequest(secrets.api.token, 'reports/funnel?' + query);
	comparison.push({ site, experiment: setup.experiment, revision: setup.revision, ...summarize(reportRows(await response.text())) });
}
console.log(JSON.stringify({ from, to, classification_only: true, arrival_tracking: 'pending', revenue_tracking: 'pending', comparison }, null, 2));
