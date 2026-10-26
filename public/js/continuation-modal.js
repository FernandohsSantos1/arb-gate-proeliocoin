export function bindContinuationModal(dialog) {
	if (dialog.tagName !== 'DIALOG') throw new TypeError('Expected a dialog element');
	const button = dialog.querySelector('[data-continuation-close]');
	if (!button || button.tagName !== 'BUTTON' || button.type !== 'button') throw new TypeError('Expected a close button');

	const close = () => dialog.close();
	const trapFocus = event => {
		if (event.key !== 'Tab') return;
		const controls = [...dialog.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')]
			.filter(control => !control.disabled && control.tabIndex >= 0 && control.getClientRects().length);
		const first = controls[0], last = controls.at(-1);
		if (!first || document.activeElement !== (event.shiftKey ? first : last)) return;
		event.preventDefault();
		(event.shiftKey ? last : first).focus();
	};

	button.addEventListener('click', close);
	dialog.addEventListener('keydown', trapFocus);

	return () => {
		button.removeEventListener('click', close);
		dialog.removeEventListener('keydown', trapFocus);
	};
}
