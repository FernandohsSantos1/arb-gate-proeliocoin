import constants from '../constants';

class KV {
	get(env, key) {
		return new Promise(async (resolve) => {
			try {
				// Retrieve the item from KV
				const value = await env.ARB_HOME_PAGES.get(key);

				if (value) {
					return resolve(value);
				} else {
					return resolve(false);
				}
			} catch (error) {
				console.error('Error retrieving from KV:', error);
				return resolve(false);
			}
		});
	}

	post(env, key, value) {
		return new Promise(async (resolve) => {
			try {
				// Convert the value to a string if it's an object
				const data = typeof value === 'string' ? value : JSON.stringify(value);

				// Add the item to KV with expiration
				await env.ARB_HOME_PAGES.put(key, data, { expirationTtl: constants.CACHE_CONTROL_TIME });

				return resolve(true);
			} catch (error) {
				console.error('Error adding to KV:', error);
				return resolve(false);
			}
		});
	}
}

export default new KV();
