import Util from '../models/Util.js';

export function continuationMarkup(entry, search, copy, open) {
	for (const key of ['title', 'description', 'open', 'continue', 'close', 'loading', 'error']) {
		if (typeof copy[key] !== 'string' || !copy[key].trim()) throw new Error('continuation_configuration_invalid');
	}
	const endpoint = Util.escapeHtml(`/go/metaoffers/${entry.source_id}/${entry.lang}/${search}`);
	const link = `<p><a href="${endpoint}"${open ? ' data-continuation-open="continuation-dialog"' : ''}>${Util.escapeHtml(copy.open)}</a></p>`;
	if (!open) return link;
	return `${link}<dialog id="continuation-dialog" data-continuation-dialog aria-labelledby="continuation-title" aria-describedby="continuation-description"
 data-endpoint="${endpoint}" data-loading="${Util.escapeHtml(copy.loading)}" data-error="${Util.escapeHtml(copy.error)}">
<h2 id="continuation-title">${Util.escapeHtml(copy.title)}</h2><p id="continuation-description">${Util.escapeHtml(copy.description)}</p>
<button type="button" data-continuation-close autofocus>${Util.escapeHtml(copy.close)}</button>
<button type="button" data-continuation-continue>${Util.escapeHtml(copy.continue)}</button>
<p data-continuation-status role="status" aria-live="polite"></p></dialog>
<script type="module" src="/public/js/continuation-navigation.js"></script>`;
}
