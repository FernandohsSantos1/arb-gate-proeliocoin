export const credentialsFile = new URL('../../adspect/credentials/secrets.json', import.meta.url);

export async function adspectRequest(token, path, method = 'GET', payload) {
	const response = await fetch('https://api.adspect.net/v1/' + path, {
		method, headers: { Authorization: 'Basic ' + btoa(token + ':'), 'Content-Type': 'application/json' },
		...(payload === undefined ? {} : { body: JSON.stringify(payload) }), signal: AbortSignal.timeout(15000),
	});
	if (!response.ok) throw new Error(`Adspect: HTTP ${response.status}`);
	return response;
}
