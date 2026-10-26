import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: Bun.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const check = (value, message) => { if (!value) throw new Error(message); };
try {
	for (const id of ['arb-gate-proeliocoin']) {
		const pages = await Bun.file(new URL(`../.artifacts/${id}-browser.json`, import.meta.url)).json();
		let posts = 0;
		for (const fixture of pages) {
			check(fixture.profile === 'simulated_continuation_and_images', 'Perfil da fixture não identifica a simulação de interface e imagens');
			const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
			const page = await context.newPage();
			const errors = [];
			page.on('pageerror', error => errors.push(error.message));
			await page.route('**/*', async route => {
				const request = route.request(), url = new URL(request.url());
				check(url.hostname !== 'rpc.adspect.net', 'RPC foi chamado pelo navegador');
				if (request.isNavigationRequest()) {
					check(request.url() === fixture.url, 'Navegador saiu do domínio ou alterou a query');
					if (request.method() === 'POST') {
						posts++;
						const form = new URLSearchParams(request.postData());
						check(form.has('data') && form.has('_adspect_challenge'), 'Fingerprint ausente no POST');
						check(Object.keys(JSON.parse(form.get('data'))).length > 0, 'Coletor não produziu dados');
						check((await request.allHeaders()).cookie?.includes(fixture.cookie), 'Cookie do desafio não foi enviado');
						return route.fulfill({ status: 200, contentType: 'text/html', body: fixture.final });
					}
					return route.fulfill({ status: 200, headers: { 'Content-Type': 'text/html', ...(fixture.cookie ? { 'Set-Cookie': fixture.cookie + '; Path=/r/berkeley-digital-mkt-certificate/; Secure; HttpOnly; SameSite=Lax' } : {}) }, body: fixture.html });
				}
				if (url.pathname.startsWith('/public/')) {
					const file = Bun.file(new URL('../public/' + url.pathname.slice(8), import.meta.url));
					if (await file.exists()) return route.fulfill({ status: 200, contentType: file.type, body: Buffer.from(await file.arrayBuffer()) });
				}
				return route.fulfill({ status: 200, contentType: request.resourceType() === 'stylesheet' ? 'text/css' : 'text/plain', body: '' });
			});
			await page.goto(fixture.url, { waitUntil: 'domcontentloaded' });
			if (fixture.final) await page.waitForSelector('[data-clickverso-history]', { state: 'attached', timeout: 15000 });
			await page.locator('h1').waitFor({ state: 'visible' });
			check(page.url() === fixture.url, 'URL final incorreta');
			check(!errors.length, errors.join('\n'));
			await context.close();
		}
		check(posts === (id === 'arb-gate-proeliocoin' ? 2 : 0), 'Contagem de POSTs incorreta');
		console.log(JSON.stringify({ site: id, profile: 'simulated_continuation_and_images', pages: pages.length,
			fingerprint_posts: posts, external_network: false, real_site_configuration_validated: false, real_images_validated: false }));
	}
} finally { await browser.close(); }
