const fixture = `<!doctype html><html lang="pt-BR"><meta charset="UTF-8"><title>Fixture da modal</title>
<main><h1 id="article">Artigo de teste</h1><p>Conteúdo local da fixture.</p><button type="button" id="open">Abrir fixture</button></main>
<dialog aria-labelledby="modal-title"><h2 id="modal-title">Título de teste</h2><p>Texto da fixture, sem uso na interface real.</p>
<button type="button" data-continuation-close>Fechar fixture</button><button type="button" id="continue">Continuar fixture</button></dialog></html>`;

function check(value, message) {
	if (!value) throw new Error(message);
}

async function openModal(page) {
	await page.locator('#open').click();
	check(await page.locator('dialog').isVisible(), 'Modal não abriu na fixture');
	check(await page.locator('[data-continuation-close]').evaluate(button => button === document.activeElement), 'Foco inicial ausente');
	await page.waitForTimeout(100);
	check(page.url() === 'about:blank' && await page.locator('dialog').isVisible(), 'Espera alterou a navegação ou fechou a modal');
}

async function checkClosed(page) {
	check(await page.locator('dialog').isHidden(), 'Modal não fechou');
	check(await page.locator('#open').evaluate(button => button === document.activeElement), 'Foco não voltou ao acionador');
	check(await page.locator('#article').isVisible(), 'Artigo local deixou de ficar disponível');
	check(page.url() === 'about:blank', 'Fechamento mudou a URL');
}

export async function checkContinuationModal(page, script) {
	const requests = [], errors = [];
	page.on('request', request => requests.push(request.url()));
	page.on('pageerror', error => errors.push(error.message));
	await page.route('**/*', route => route.abort());
	await page.setContent(fixture);
	check(await page.locator('#article').isVisible() && await page.locator('dialog').isHidden(), 'Leitura inicial sem script falhou');
	await page.evaluate(async source => {
		const module = await import('data:text/javascript,' + encodeURIComponent(source));
		module.bindContinuationModal(document.querySelector('dialog'));
		document.querySelector('#open').onclick = () => document.querySelector('dialog').showModal();
	}, script);
	check(await page.locator('dialog').isHidden(), 'Instalação do motor abriu a modal');
	await checkKeyboardFocus(page);
	for (const key of ['Escape', 'Enter', 'Space']) {
		await openModal(page);
		await page.keyboard.press(key);
		await checkClosed(page);
	}
	await openModal(page);
	await page.locator('[data-continuation-close]').click();
	await checkClosed(page);
	check(!requests.length && !errors.length, JSON.stringify({ requests, errors }));
	return { button: true, escape: true, keyboard: true, focus_return: true, focus_trap: true,
		local_article: true, waiting_stays_local: true, network_requests: requests.length };
}

async function checkKeyboardFocus(page) {
	await openModal(page);
	await page.keyboard.press('Tab');
	check(await page.locator('#continue').evaluate(button => button === document.activeElement), 'Tab não alcançou botão de continuação');
	await page.keyboard.press('Tab');
	check(await page.locator('[data-continuation-close]').evaluate(button => button === document.activeElement), 'Tab saiu da modal');
	await page.keyboard.press('Shift+Tab');
	check(await page.locator('#continue').evaluate(button => button === document.activeElement), 'Shift+Tab saiu da modal');
	await page.keyboard.press('Escape');
	await checkClosed(page);
}
