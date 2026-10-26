import constants from '../constants';

class Requests {
	// New method to get a post by its slug and language
	getPostData(slug, language, domain, reqQuery) {
		return new Promise(async (resolve) => {
			let cmsEndpoint = `${constants.CMS_ENDPOINT}/api/posts/get/${language}/${slug}/`;

			for (let query in reqQuery) {
				if (cmsEndpoint.includes('?')) {
					cmsEndpoint += `&${query}=${reqQuery[query]}`;
				} else {
					cmsEndpoint += `?${query}=${reqQuery[query]}`;
				}
			}

			try {
				// Make the fetch request to get the post, now with method POST to send domain in the body
				const response = await fetch(cmsEndpoint, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						domain, // Send the domain in the request body
					}),
				});

				// Check if the response was successful
				if (!response.ok) {
					throw new Error(`Erro na requisição: ${response.status}`);
				}

				// Parse the response content
				const contentType = response.headers.get('content-type');
				let data;
				if (contentType && contentType.includes('application/json')) {
					// If the response is JSON, parse it
					data = await response.json();
				} else {
					// Otherwise, treat it as text
					data = await response.text();
				}

				// Return the post data if it's JSON and contains the 'post_data' key
				if (data && typeof data === 'object' && 'post_data' in data) {
					return resolve(data.post_data);
				}

				// Otherwise, return the whole response
				return resolve(data);
			} catch (error) {
				console.error('Erro ao buscar post:', error.message);
				return resolve(false);
			}
		});
	}

	getCategoryData(slug, language, domain, page, reqQuery) {
		return new Promise(async (resolve) => {
			let cmsEndpoint = `${constants.CMS_ENDPOINT}/api/categories/get/${language}/${slug}/`;

			for (let query in reqQuery) {
				if (cmsEndpoint.includes('?')) {
					cmsEndpoint += `&${query}=${reqQuery[query]}`;
				} else {
					cmsEndpoint += `?${query}=${reqQuery[query]}`;
				}
			}

			try {
				// Make the fetch request to get the post, now with method POST to send domain in the body
				const response = await fetch(cmsEndpoint, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						domain, // Send the domain in the request body
						page,
						definedPageSize: 21,
					}),
				});

				// Check if the response was successful
				if (!response.ok) {
					throw new Error(`Erro na requisição: ${response.status}`);
				}

				// Parse the response content
				const contentType = response.headers.get('content-type');
				let data;
				if (contentType && contentType.includes('application/json')) {
					// If the response is JSON, parse it
					data = await response.json();
				} else {
					// Otherwise, treat it as text
					data = await response.text();
				}

				// Return the post data if it's JSON and contains the 'post_data' key
				if (data && typeof data === 'object' && 'post_data' in data) {
					return resolve(data.post_data);
				}

				// Otherwise, return the whole response
				return resolve(data);
			} catch (error) {
				console.error('Erro ao buscar post:', error.message);
				return resolve(false);
			}
		});
	}

	getAuthorData(slug, language, domain, page, reqQuery) {
		return new Promise(async (resolve) => {
			let cmsEndpoint = `${constants.CMS_ENDPOINT}/api/authors/get/${language}/${slug}/`;

			for (let query in reqQuery) {
				if (cmsEndpoint.includes('?')) {
					cmsEndpoint += `&${query}=${reqQuery[query]}`;
				} else {
					cmsEndpoint += `?${query}=${reqQuery[query]}`;
				}
			}

			try {
				// Make the fetch request to get the post, now with method POST to send domain in the body
				const response = await fetch(cmsEndpoint, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						domain, // Send the domain in the request body
						page,
						definedPageSize: 21,
					}),
				});

				// Check if the response was successful
				if (!response.ok) {
					throw new Error(`Erro na requisição: ${response.status}`);
				}

				// Parse the response content
				const contentType = response.headers.get('content-type');
				let data;
				if (contentType && contentType.includes('application/json')) {
					// If the response is JSON, parse it
					data = await response.json();
				} else {
					// Otherwise, treat it as text
					data = await response.text();
				}

				// Return the post data if it's JSON and contains the 'post_data' key
				if (data && typeof data === 'object' && 'post_data' in data) {
					return resolve(data.post_data);
				}

				// Otherwise, return the whole response
				return resolve(data);
			} catch (error) {
				console.error('Erro ao buscar Autor:', error.message);
				return resolve(false);
			}
		});
	}

	getPageData(slug, language, domain, reqQuery) {
		return new Promise(async (resolve) => {
			let cmsEndpoint = `${constants.CMS_ENDPOINT}/api/pages/get/${language}/${slug}/`;

			for (let query in reqQuery) {
				if (cmsEndpoint.includes('?')) {
					cmsEndpoint += `&${query}=${reqQuery[query]}`;
				} else {
					cmsEndpoint += `?${query}=${reqQuery[query]}`;
				}
			}

			try {
				// Make the fetch request to get the post, now with method POST to send domain in the body
				const response = await fetch(cmsEndpoint, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						domain, // Send the domain in the request body
					}),
				});

				// Check if the response was successful
				if (!response.ok) {
					throw new Error(`Erro na requisição: ${response.status}`);
				}

				// Parse the response content
				const contentType = response.headers.get('content-type');
				let data;
				if (contentType && contentType.includes('application/json')) {
					// If the response is JSON, parse it
					data = await response.json();
				} else {
					// Otherwise, treat it as text
					data = await response.text();
				}

				// Return the post data if it's JSON and contains the 'post_data' key
				if (data && typeof data === 'object' && 'post_data' in data) {
					return resolve(data.post_data);
				}

				// Otherwise, return the whole response
				return resolve(data);
			} catch (error) {
				console.error('Erro ao buscar post:', error.message);
				return resolve(false);
			}
		});
	}

	getLastPosts(language, domain, reqQuery) {
		return new Promise(async (resolve) => {
			// Construct the API URL by injecting the language parameter
			let cmsEndpoint = `${constants.CMS_ENDPOINT}/api/posts/get/last-posts/${language}/`;

			for (let query in reqQuery) {
				if (cmsEndpoint.includes('?')) {
					cmsEndpoint += `&${query}=${reqQuery[query]}`;
				} else {
					cmsEndpoint += `?${query}=${reqQuery[query]}`;
				}
			}

			try {
				// Make the fetch request to the API endpoint with method POST
				const response = await fetch(cmsEndpoint, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						domain, // Send the domain in the request body
					}),
				});

				// Check if the response was successful (status code 200-299)
				if (!response.ok) {
					throw new Error(`Request failed with status: ${response.status}`);
				}

				// Determine the response content type
				const contentType = response.headers.get('content-type');
				let data;

				if (contentType && contentType.includes('application/json')) {
					// If the response is JSON, parse it
					data = await response.json();
				} else {
					// Otherwise, treat it as text
					data = await response.text();
				}

				// Check if the response contains the 'last_posts' key
				if (data && typeof data === 'object' && 'last_posts' in data) {
					return resolve(data.last_posts);
				}

				// If 'last_posts' is not present, resolve with the entire data
				return resolve(data);
			} catch (error) {
				console.error('Error fetching last posts:', error.message);
				return resolve(false);
			}
		});
	}

	getLandingData(slug, language, domain, reqQuery) {
		return new Promise(async (resolve) => {
			// Construct the API URL by injecting the language parameter
			let apiUrl = `${constants.CMS_ENDPOINT}/api/landing/get/${language}/${slug}/`;

			for (let query in reqQuery) {
				if (apiUrl.includes('?')) {
					apiUrl += `&${query}=${reqQuery[query]}`;
				} else {
					apiUrl += `?${query}=${reqQuery[query]}`;
				}
			}

			try {
				// Make the fetch request to get the post, now with method POST to send domain in the body
				const response = await fetch(apiUrl, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						domain, // Send the domain in the request body
					}),
				});

				// Check if the response was successful
				if (!response.ok) {
					throw new Error(`Erro na requisição: ${response.status}`);
				}

				// Parse the response content
				const contentType = response.headers.get('content-type');
				let data;
				if (contentType && contentType.includes('application/json')) {
					// If the response is JSON, parse it
					data = await response.json();
				} else {
					// Otherwise, treat it as text
					data = await response.text();
				}

				// Return the post data if it's JSON and contains the 'post_data' key
				if (data && typeof data === 'object' && 'post_data' in data) {
					return resolve(data.post_data);
				}

				// Otherwise, return the whole response
				return resolve(data);
			} catch (error) {
				console.error('Erro ao buscar post:', error.message);
				return resolve(false);
			}
		});
	}

	getHomeData(language, domain, reqQuery) {
		return new Promise(async (resolve) => {
			let cmsEndpoint = `${constants.CMS_ENDPOINT}/api/home/news-get/${language}/`;

			for (let query in reqQuery) {
				if (cmsEndpoint.includes('?')) {
					cmsEndpoint += `&${query}=${reqQuery[query]}`;
				} else {
					cmsEndpoint += `?${query}=${reqQuery[query]}`;
				}
			}

			try {
				// Make the fetch request to get the post, now with method POST to send domain in the body
				const response = await fetch(cmsEndpoint, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						domain, // Send the domain in the request body
					}),
				});

				// Check if the response was successful
				if (!response.ok) {
					throw new Error(`Erro na requisição: ${response.status}`);
				}

				// Parse the response content
				const contentType = response.headers.get('content-type');
				let data;
				if (contentType && contentType.includes('application/json')) {
					// If the response is JSON, parse it
					data = await response.json();
				} else {
					// Otherwise, treat it as text
					data = await response.text();
				}

				// Otherwise, return the whole response
				return resolve(data);
			} catch (error) {
				console.error('Erro ao buscar post:', error.message);
				return resolve(false);
			}
		});
	}

	async getDomainConfig(domain) {
		try {
			const response = await fetch(`${constants.CMS_ENDPOINT}/api/domain_configs/get/?domain_name=${domain}`);
			return await response.json();
		} catch (error) {
			console.log('erro ao buscar domain config', error);
			return {};
		}
	}

	async getAuthorsListData(lang, reqQuery) {
		let cmsEndpoint = `${constants.CMS_ENDPOINT}/api/authors/list/get/${lang}/`;
		for (let query in reqQuery) {
			if (cmsEndpoint.includes('?')) {
				cmsEndpoint += `&${query}=${reqQuery[query]}`;
			} else {
				cmsEndpoint += `?${query}=${reqQuery[query]}`;
			}
		}
		try {
			const response = await fetch(cmsEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					domain: constants.CMS_DOMAIN,
					lang: lang,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Falha ao buscar a lista de autores');
			}

			const data = await response.json();
			return data; // { authors: [...], last_posts: [...] }
		} catch (error) {
			console.error('Erro ao buscar a lista de autores:', error);
			throw error;
		}
	}

	async getAggregatorData(lang, slug, reqQuery) {
		let cmsEndpoint = `${constants.CMS_ENDPOINT}/api/aggregators/get/${slug}?lang=${lang}&domain=${constants.CMS_DOMAIN}`;
		for (let query in reqQuery) {
			if (cmsEndpoint.includes('?')) {
				cmsEndpoint += `&${query}=${reqQuery[query]}`;
			} else {
				cmsEndpoint += `?${query}=${reqQuery[query]}`;
			}
		}
		try {
			const response = await fetch(cmsEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					domain: constants.CMS_DOMAIN,
					lang: lang,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Falha ao buscar a lista de autores');
			}


			const data = await response.json();
			return data; // { authors: [...], last_posts: [...] }
		} catch (error) {
			console.error('Erro ao buscar a agregador:', error);
			throw error;
		}
	}

	async getLandersAndAggregators(lang, reqQuery) {
		let cmsEndpoint = `${constants.CMS_ENDPOINT}/api/landers/?domain=${constants.CMS_DOMAIN}&lang=${lang}`;
		for (let query in reqQuery) {
			if (cmsEndpoint.includes('?')) {
				cmsEndpoint += `&${query}=${reqQuery[query]}`;
			} else {
				cmsEndpoint += `?${query}=${reqQuery[query]}`;
			}
		}
		try {
			const options = {method: 'GET'};

			const response = await fetch(cmsEndpoint, options);

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Falha ao buscar a lista de urls');
			}

			const data = await response.json();
			return data;
		} catch (error) {
			console.error('Erro ao buscar a agregador:', error);
			throw error;
		}
	}

	async getSearchResults(query, domain, language, reqQuery) {
		let cmsEndpoint = `${
			constants.CMS_ENDPOINT
		}/api/posts/search/${language}/?q=${encodeURIComponent(query)}`;
		for (let query in reqQuery) {
			if (cmsEndpoint.includes('?')) {
				cmsEndpoint += `&${query}=${reqQuery[query]}`;
			} else {
				cmsEndpoint += `?${query}=${reqQuery[query]}`;
			}
		}
		try {
			// Construct the CMS search endpoint.
			// We'll define `/api/posts/search/:language` on the CMS side.
			// Or you can use a query param. This example uses the path param for language:
			// We’ll POST the domain to the CMS in the body to ensure we only search in that domain.
			const response = await fetch(cmsEndpoint, {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({
					domain: domain,
				}),
			});


			if (!response.ok) {
				throw new Error(`Failed search request: ${response.status}`);
			}

			const data = await response.json();

			// The CMS will return { posts: [...] }. Return that array or the entire data.
			return data.posts || [];
		} catch (error) {
			console.error('Error in getSearchResults:', error);
			return [];
		}
	}
}

export default new Requests();
