(() => {
	const button = document.querySelector('.mobile-menu-toggle');
	const navigation = document.querySelector('.main-nav');
	const overlay = document.querySelector('.mobile-overlay');
	if (!button || !navigation || !overlay) return;
	const mobile = window.matchMedia('(max-width: 1023px)');

	function setOpen(open) {
		const visible = open && mobile.matches;
		navigation.classList.toggle('open', visible);
		navigation.inert = mobile.matches && !visible;
		overlay.classList.toggle('active', visible);
		overlay.setAttribute('aria-hidden', String(!visible));
		button.setAttribute('aria-expanded', String(visible));
		button.setAttribute('aria-label', visible ? 'Fechar menu' : 'Abrir menu');
	}

	button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
	overlay.addEventListener('click', () => setOpen(false));
	navigation.addEventListener('click', (event) => {
		if (event.target.closest('a')) setOpen(false);
	});
	document.addEventListener('keydown', (event) => {
		if (event.key !== 'Escape' || button.getAttribute('aria-expanded') !== 'true') return;
		setOpen(false);
		button.focus();
	});
	mobile.addEventListener('change', () => setOpen(false));
	setOpen(false);
})();
