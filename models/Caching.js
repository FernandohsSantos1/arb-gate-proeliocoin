import constants from '../constants';

class Caching {
	async defaultCache(request, env, ctx) {
		if (request.url.includes('cache=delete')) {
			await caches.default.delete(request.url.split('?')[0], {});
		}

		if (constants.CACHING) {
			let response = await caches.default.match(request.url.split('?')[0]);

			if (response) {
				return response;
			}
		}
	}
}

export default new Caching();
