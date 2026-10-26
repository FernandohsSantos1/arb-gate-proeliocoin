import { chromium } from 'playwright';
import { checkContinuationModal } from './continuation-modal-browser.js';

const script = await Bun.file(new URL('../public/js/continuation-modal.js', import.meta.url)).text();
const browser = await chromium.launch({ executablePath: Bun.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
try {
	const page = await browser.newPage();
	console.log(JSON.stringify(await checkContinuationModal(page, script)));
} finally { await browser.close(); }
