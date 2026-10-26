import { bindContinuationModal } from './continuation-modal.js';

async function resolveDestination(fetchDestination, endpoint, controller, hostname) {
	const response = await fetchDestination(endpoint.href, { headers: { Accept: 'application/json' }, credentials: 'same-origin',
		redirect: 'error', signal: controller.signal });
	if (!response.ok || !response.headers.get('Content-Type')?.startsWith('application/json')) throw new Error('Invalid continuation response');
	const payload = await response.json(), target = new URL(payload.url);
	if (typeof payload.url !== 'string' || target.protocol !== 'https:' || target.username || target.password || target.port || target.hash ||
		!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(target.hostname) || target.hostname.replace(/^www\./, '') === hostname.replace(/^www\./, '') ||
		!/^\/v\/[a-z0-9-]+\/$/.test(target.pathname)) throw new Error('Invalid continuation destination');
	return target.href;
}

export function bindContinuationNavigation(dialog, fetchDestination = fetch, navigate = target => window.location.assign(target)) {
	const unbindModal = bindContinuationModal(dialog);
	const button = dialog.querySelector('[data-continuation-continue]'), status = dialog.querySelector('[data-continuation-status]');
	const document = dialog.ownerDocument, origin = document.location.origin;
	const endpoint = new URL(dialog.dataset.endpoint, document.location.href);
	if (endpoint.origin !== origin || endpoint.username || endpoint.password || endpoint.hash ||
		!/^\/go\/metaoffers\/\d+\/(pt|en|es)\/$/.test(endpoint.pathname)) throw new TypeError('Invalid continuation endpoint');
	let operation = null;
	const cancel = () => {
		operation?.abort(); operation = null;
		button.disabled = false; status.textContent = '';
		dialog.removeAttribute('aria-busy');
	};
	const continueToPartner = async () => {
		if (operation || !dialog.open) return;
		const controller = new AbortController();
		operation = controller; button.disabled = true;
		dialog.setAttribute('aria-busy', 'true'); status.textContent = dialog.dataset.loading;
		try {
			const target = await resolveDestination(fetchDestination, endpoint, controller, document.location.hostname);
			if (operation !== controller || controller.signal.aborted || !dialog.open) return;
			navigate(target);
		} catch {
			if (operation === controller && !controller.signal.aborted && dialog.open) status.textContent = dialog.dataset.error;
		} finally {
			if (operation === controller) { operation = null; button.disabled = false; dialog.removeAttribute('aria-busy'); }
		}
	};
	const open = event => { event.preventDefault(); if (!dialog.open) dialog.showModal(); };
	const openers = [...document.querySelectorAll(`[data-continuation-open="${dialog.id}"]`)];
	for (const opener of openers) opener.addEventListener('click', open);
	button.addEventListener('click', continueToPartner);
	dialog.addEventListener('close', cancel); dialog.addEventListener('cancel', cancel);
	return () => {
		cancel(); unbindModal();
		for (const opener of openers) opener.removeEventListener('click', open);
		button.removeEventListener('click', continueToPartner);
		dialog.removeEventListener('close', cancel); dialog.removeEventListener('cancel', cancel);
	};
}

export function startContinuationDialog(dialog, fetchDestination, navigate) {
	const unbind = bindContinuationNavigation(dialog, fetchDestination, navigate);
	const article = dialog.ownerDocument.querySelector('main');
	if (article) { article.setAttribute('tabindex', '-1'); article.focus({ preventScroll: true }); }
	dialog.showModal();
	return unbind;
}

if (typeof document !== 'undefined') for (const dialog of document.querySelectorAll('[data-continuation-dialog]')) {
	startContinuationDialog(dialog);
}
