import { expect, test } from 'bun:test';
import { bindContinuationNavigation, startContinuationDialog } from '../public/js/continuation-navigation.js';

// DOM mínimo para testar o estado e a concorrência. A renderização real no navegador continua pendente.
function fixture() {
	const document = { location: new URL('https://proeliocoin.com/r/course/'), activeElement: null };
	class Element extends EventTarget {
		constructor(tagName) { super(); this.tagName = tagName; this.type = 'button'; this.disabled = false; this.textContent = ''; this.attributes = new Map(); }
		setAttribute(key, value) { this.attributes.set(key, value); }
		removeAttribute(key) { this.attributes.delete(key); }
		focus() { document.activeElement = this; }
	}
	const close = new Element('BUTTON'), button = new Element('BUTTON'), status = new Element('P');
	const main = new Element('MAIN'), opener = new Element('A'), dialog = new Element('DIALOG');
	dialog.id = 'continuation-dialog'; dialog.ownerDocument = document; dialog.open = false;
	dialog.dataset = { endpoint: '/go/metaoffers/123/pt/?gclid=synthetic', loading: 'Loading fixture', error: 'Error fixture' };
	dialog.querySelector = selector => ({ '[data-continuation-close]': close, '[data-continuation-continue]': button, '[data-continuation-status]': status })[selector];
	dialog.querySelectorAll = () => [close, button];
	dialog.showModal = () => { dialog.returnFocus = document.activeElement; dialog.open = true; close.focus(); };
	dialog.close = () => { dialog.open = false; dialog.returnFocus?.focus(); dialog.dispatchEvent(new Event('close')); };
	document.querySelectorAll = () => [opener]; document.querySelector = selector => selector === 'main' ? main : null;
	return { document, dialog, button, close, status, main, opener, navigations: [] };
}

const click = () => new Event('click', { cancelable: true });
const destination = 'https://partner.example/v/same-course/?gclid=synthetic';

test('instalar, abrir, esperar e fechar não consultam nem navegam', async () => {
	const value = fixture(), calls = [];
	const dispose = bindContinuationNavigation(value.dialog, async url => { calls.push(url); }, url => value.navigations.push(url));
	expect(value.dialog.open).toBe(false);
	value.dialog.showModal(); await Bun.sleep(0);
	value.close.dispatchEvent(click());
	expect(value.dialog.open).toBe(false); expect(calls).toHaveLength(0); expect(value.navigations).toHaveLength(0);
	dispose();
});

test('abertura automática retorna o foco ao artigo; reabertura retorna ao acionador', () => {
	const value = fixture(), calls = [];
	const dispose = startContinuationDialog(value.dialog, async url => { calls.push(url); }, url => value.navigations.push(url));
	expect(value.dialog.open).toBe(true); expect(value.document.activeElement).toBe(value.close);
	value.dialog.close(); expect(value.document.activeElement).toBe(value.main);
	expect(value.main.attributes.get('tabindex')).toBe('-1');
	value.opener.focus(); value.opener.dispatchEvent(click());
	expect(value.dialog.open).toBe(true);
	value.dialog.close(); expect(value.document.activeElement).toBe(value.opener);
	expect(calls).toHaveLength(0); expect(value.navigations).toHaveLength(0); dispose();
});

test('clique consulta apenas endpoint local e navega após JSON e URL válidos', async () => {
	const value = fixture(), calls = [];
	const dispose = bindContinuationNavigation(value.dialog, async (url, options) => {
		calls.push({ url, options }); return Response.json({ url: destination });
	}, url => value.navigations.push(url));
	value.dialog.showModal(); value.button.dispatchEvent(click()); await Bun.sleep(0);
	expect(calls).toHaveLength(1); expect(calls[0].url).toBe('https://proeliocoin.com/go/metaoffers/123/pt/?gclid=synthetic');
	expect(calls[0].options).toMatchObject({ headers: { Accept: 'application/json' }, credentials: 'same-origin', redirect: 'error' });
	expect(value.navigations).toEqual([destination]); dispose();
});

test('cliques concorrentes compartilham apenas a operação pendente', async () => {
	const value = fixture(); let resolve, calls = 0;
	const dispose = bindContinuationNavigation(value.dialog, () => { calls++; return new Promise(done => { resolve = done; }); }, url => value.navigations.push(url));
	value.dialog.showModal(); value.button.dispatchEvent(click()); value.button.dispatchEvent(click());
	expect(calls).toBe(1); expect(value.button.disabled).toBe(true); expect(value.status.textContent).toBe('Loading fixture');
	resolve(Response.json({ url: destination })); await Bun.sleep(0);
	expect(value.navigations).toEqual([destination]); expect(value.button.disabled).toBe(false); dispose();
});

test.each(['close', 'cancel'])('evento %s aborta consulta e resposta tardia não navega', async type => {
	const value = fixture(); let resolve, signal;
	const dispose = bindContinuationNavigation(value.dialog, (_url, options) => {
		signal = options.signal; return new Promise(done => { resolve = done; });
	}, url => value.navigations.push(url));
	value.dialog.showModal(); value.button.dispatchEvent(click());
	if (type === 'close') value.dialog.close(); else value.dialog.dispatchEvent(new Event('cancel'));
	expect(signal.aborted).toBe(true); expect(value.button.disabled).toBe(false); expect(value.status.textContent).toBe('');
	resolve(Response.json({ url: destination })); await Bun.sleep(0);
	expect(value.navigations).toHaveLength(0); expect(value.status.textContent).toBe(''); dispose();
});

test('fechar, reabrir e tentar novamente impede navegação da operação anterior', async () => {
	const value = fixture(), completions = [], signals = [];
	const dispose = bindContinuationNavigation(value.dialog, (_url, options) => {
		signals.push(options.signal); return new Promise(resolve => completions.push(resolve));
	}, url => value.navigations.push(url));
	value.dialog.showModal(); value.button.dispatchEvent(click()); value.dialog.close();
	value.dialog.showModal(); value.button.dispatchEvent(click());
	expect(signals[0].aborted).toBe(true); expect(signals[1].aborted).toBe(false);
	completions[0](Response.json({ url: 'https://partner.example/v/stale-course/' })); await Bun.sleep(0);
	expect(value.navigations).toHaveLength(0); expect(value.button.disabled).toBe(true);
	completions[1](Response.json({ url: destination })); await Bun.sleep(0);
	expect(value.navigations).toEqual([destination]); dispose();
});

test('fechar durante a leitura do JSON também impede resposta tardia', async () => {
	const value = fixture(); let resolve;
	const dispose = bindContinuationNavigation(value.dialog, async () => ({ ok: true, headers: new Headers({ 'Content-Type': 'application/json' }),
		json: () => new Promise(done => { resolve = done; }) }), url => value.navigations.push(url));
	value.dialog.showModal(); value.button.dispatchEvent(click()); await Bun.sleep(0);
	value.dialog.close(); value.dialog.showModal(); resolve({ url: destination }); await Bun.sleep(0);
	expect(value.navigations).toHaveLength(0); dispose();
});

test('falha mantém artigo e libera uma nova tentativa', async () => {
	const value = fixture(); let calls = 0;
	const dispose = bindContinuationNavigation(value.dialog, async () => ++calls === 1 ? new Response(null, { status: 503 }) : Response.json({ url: destination }), url => value.navigations.push(url));
	value.dialog.showModal(); value.button.dispatchEvent(click()); await Bun.sleep(0);
	expect(value.status.textContent).toBe('Error fixture'); expect(value.dialog.open).toBe(true); expect(value.button.disabled).toBe(false);
	value.button.dispatchEvent(click()); await Bun.sleep(0);
	expect(calls).toBe(2); expect(value.navigations).toEqual([destination]); dispose();
});

test.each(['javascript:alert(1)', 'http://partner.example/v/course/', 'https://user:pass@partner.example/v/course/',
	'https://partner.example:8443/v/course/', 'https://partner.example/r/course/', 'https://proeliocoin.com/v/course/',
	'https://www.proeliocoin.com/v/course/', 'https://127.0.0.1/v/course/', 'https://partner.example/v/course/#fragment', '/v/course/'])('URL inválida %s mantém dialog e artigo', async url => {
	const value = fixture();
	const dispose = bindContinuationNavigation(value.dialog, async () => Response.json({ url }), target => value.navigations.push(target));
	value.dialog.showModal(); value.button.dispatchEvent(click()); await Bun.sleep(0);
	expect(value.navigations).toHaveLength(0); expect(value.dialog.open).toBe(true); expect(value.status.textContent).toBe('Error fixture'); dispose();
});

test('resposta sem JSON não pode navegar', async () => {
	const value = fixture();
	const dispose = bindContinuationNavigation(value.dialog, async () => new Response('<html>erro</html>', { headers: { 'Content-Type': 'text/html' } }), url => value.navigations.push(url));
	value.dialog.showModal(); value.button.dispatchEvent(click()); await Bun.sleep(0);
	expect(value.navigations).toHaveLength(0); expect(value.status.textContent).toBe('Error fixture'); dispose();
});

test('remover listeners aborta e invalida a operação pendente', async () => {
	const value = fixture(); let resolve, calls = 0;
	const dispose = bindContinuationNavigation(value.dialog, () => { calls++; return new Promise(done => { resolve = done; }); }, url => value.navigations.push(url));
	value.dialog.showModal(); value.button.dispatchEvent(click()); dispose();
	resolve(Response.json({ url: destination })); await Bun.sleep(0); value.button.dispatchEvent(click());
	expect(calls).toBe(1); expect(value.navigations).toHaveLength(0);
});
