// Function to dynamically load a TradingView widget
function loadTradingViewWidget(container, widgetScriptUrl, widgetConfig) {
	// Create a script element
	var script = document.createElement('script');
	script.type = 'text/javascript';
	script.src = widgetScriptUrl;
	script.async = true;

	// Set the JSON configuration as the script's innerHTML
	script.innerHTML = JSON.stringify(widgetConfig);

	// Append the script to the container
	container.appendChild(script);
}

document.addEventListener('DOMContentLoaded', function () {
	if (ENVIROMENT_CONSTANTS.SHOW_IFRAMES) {
		let iframes = {
			top_bar: document.getElementById('tradingview-ticker-tape'),
			first_card: document.getElementById('tradingview-market-overview'),
			second_card: document.getElementById('tradingview-hotlists'),
		};

		// Function to load all TradingView widgets for desktop
		function loadTradingViewWidgetsForDesktop() {
			// Ticker Tape Widget Configuration
			/* ───────── 1. Ticker-Tape ───────── */
			const pathLang = window.location.pathname.split('/')[1];
			const LANGS = {
				pt: {
					locale: 'pt',
					t: {
						econ: 'Economia',
						invest: 'Investimentos',
						cards: 'Cartão de Crédito',
						loans: 'Empréstimo Pessoal',
						cur: 'Moedas',
					},
				},
			};
			const langKey = pathLang.length === 2 && LANGS[pathLang] ? pathLang : 'pt';
			const { locale, t } = LANGS[langKey];

			/* Paleta dos gráficos alinhada ao índigo de index.css. */
			const chartColors = {
				plotLineColorGrowing: '#4338ca',
				plotLineColorFalling: '#4338ca',
				gridLineColor: 'rgba(30, 27, 75, 0.06)',
				scaleFontColor: '#4b5563',
				belowLineFillColorGrowing: 'rgba(67, 56, 202, 0.16)',
				belowLineFillColorFalling: 'rgba(67, 56, 202, 0.16)',
				belowLineFillColorGrowingBottom: 'rgba(67, 56, 202, 0)',
				belowLineFillColorFallingBottom: 'rgba(67, 56, 202, 0)',
				symbolActiveColor: 'rgba(67, 56, 202, 0.08)',
			};

			/* ───────── 1) Ticker-Tape ───────── */
			const tickerTapeConfig = {
				symbols: [
					// Índices globais e ETFs amplos

					// Setores & Blue Chips

					// Ações globais
					{ description: 'Apple Inc.', proName: 'NASDAQ:AAPL' }, // Tecnologia e eletrônicos de consumo
					{ description: 'NVIDIA Corp.', proName: 'NASDAQ:NVDA' }, // Processadores gráficos e inteligência artificial
					{ description: 'Procter & Gamble Co.', proName: 'NYSE:PG' }, // Bens de consumo e higiene
					{ description: 'Mastercard Inc.', proName: 'NYSE:MA' }, // Serviços financeiros e pagamentos globais

					// Brasil & Commodities
					{ description: 'Petrobras', proName: 'BMFBOVESPA:PETR4' }, // Energia e petróleo
					{ description: 'Ambev S.A.', proName: 'BMFBOVESPA:ABEV3' }, // Bebidas e consumo
					{ description: 'Gold / USD', proName: 'OANDA:XAUUSD' }, // Ouro como reserva de valor

					// Criptomoedas
					{ description: 'Bitcoin / USD', proName: 'COINBASE:BTCUSD' }, // Principal criptomoeda
					{ description: 'Solana / USD', proName: 'BINANCE:SOLUSD' }, // Blockchain de alta performance
				],

				showSymbolLogo: true,
				colorTheme: 'light',
				isTransparent: true,
				displayMode: 'regular',
				width: '100%',
				height: 44,
			};

			/* ───────── 2) Market-Overview ───────── */
			const marketOverviewConfig = {
				colorTheme: 'light',
				dateRange: '1M',
				showChart: true,
				locale, // ← traduz menus do widget
				largeChartUrl: '',
				isTransparent: false,
				showSymbolLogo: true,
				showFloatingTooltip: false,
				width: '100%',
				height: 330,
				...chartColors,
				tabs: [
					/* — Índices (índices financeiros globais) — */
					{
						title: t.econ,
						symbols: [
							{
								s: 'AMEX:XLK',
								d: 'Technology Select Sector SPDR Fund (EUA – tecnologia)',
							},
							{ s: 'BMFBOVESPA:IBOV', d: 'Ibovespa (Brazil)' }, // América do Sul - Brasil
						],
						originalTitle: 'Global Indices',
					},

					/* — Ações & Investimentos — */
					{
						title: t.invest,
						symbols: [
							{ s: 'NASDAQ:AAPL', d: 'Apple' },
							{ s: 'NYSE:PBR', d: 'Petrobras ADR' },
							{ s: 'NYSE:VALE', d: 'Vale ADR' },
						],
						originalTitle: 'Stocks & Investments',
					},

					/* — Cartões de Crédito e Pagamentos — */
					{
						title: t.cards,
						symbols: [
							{ s: 'NYSE:MA', d: 'Mastercard' }, // Rede global de cartões
							{ s: 'NYSE:V', d: 'Visa' }, // Líder mundial em pagamentos

							{ s: 'NASDAQ:AFRM', d: 'Affirm Holdings' }, // Especialista em "Buy Now, Pay Later"
						],
						originalTitle: 'Credit Cards & Digital Payments',
					},

					/* — Empréstimos & Fintechs — */
					{
						title: t.loans,
						symbols: [
							{ s: 'NASDAQ:SOFI', d: 'SoFi' },
							{ s: 'NASDAQ:UPST', d: 'Upstart' },
							{ s: 'NYSE:LC', d: 'LendingClub' },
							{ s: 'NASDAQ:AFRM', d: 'Affirm' },
							{ s: 'NYSE:RKT', d: 'Rocket Cos.' },
						],
						originalTitle: 'Loans & Fintech',
					},

					/* — Moedas & Forex — */
					{
						title: t.cur,
						symbols: [
							{ s: 'FX:EURUSD', d: 'EUR / USD' },
							{ s: 'FX_IDC:USDBRL', d: 'USD / BRL' },
							{ s: 'FX_IDC:USDMXN', d: 'USD / MXN' },
							{ s: 'FX:USDJPY', d: 'USD / JPY' },
							{ s: 'TVC:DXY', d: 'US Dollar Index' },
						],
						originalTitle: 'Currencies & Forex',
					},
				],
			};

			/* ───────── 3) Hotlists ───────── */
			const hotlistsConfig = {
				colorTheme: 'light',
				dateRange: '1D',
				exchange: 'US', // maior liquidez global (NYSE/NASDAQ)
				showChart: true,
				locale, // ← traduz Hotlists
				largeChartUrl: '',
				isTransparent: false,
				showSymbolLogo: false,
				showFloatingTooltip: false,
				width: '100%',
				height: 330,
				...chartColors,
			};

			// Load Ticker Tape Widget
			if (iframes.top_bar) {
				loadTradingViewWidget(
					iframes.top_bar,
					'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js',
					tickerTapeConfig
				);
			}

			// Load Market Overview Widget
			if (iframes.first_card) {
				loadTradingViewWidget(
					iframes.first_card,
					'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js',
					marketOverviewConfig
				);
			}

			// Load Hotlists Widget
			if (iframes.second_card) {
				loadTradingViewWidget(
					iframes.second_card,
					'https://s3.tradingview.com/external-embedding/embed-widget-hotlists.js',
					hotlistsConfig
				);
			}
		}

		if (iframes.first_card || iframes.second_card) {
			document.querySelectorAll('.sidebar-block').forEach((el) => el.classList.add('mt-4'));
		}

		if (iframes.first_card) {
			document.getElementById('tradingview-hotlists')?.classList.add('mt-4');
		}

		loadTradingViewWidgetsForDesktop();
	}

	// Select all forms with the class 'search-form'
	const searchForms = document.querySelectorAll('.search-form');

	const pathname = window.location.pathname.split('/')[1];
	if (pathname.length === 2) {
		document.querySelector('.logo').href = `/${pathname}/`;
		document.querySelector('.footer-logo').href = `/${pathname}/`;
	}

	// Iterate over each form and attach the submit event listener
	searchForms.forEach((form) => {
		form.addEventListener('submit', (event) => {
			event.preventDefault(); // Prevent the default form s
			// ubmission behavior

			// Find the input within the current form
			const input = form.querySelector('input[type="text"]');
			if (!input) {
				console.error('Search input field not found within the form.');
				return;
			}

			// Retrieve and trim the input value
			const query = input.value.trim();

			// Get the language from the URL (assuming it's the first part of the path)
			const lang = document.documentElement.lang || 'pt';

			// Define the messages for each language
			const messages = {
				pt: 'Por favor, introduza um termo de pesquisa válido.',
				// Add more languages as needed
			};

			// Check if the input is not empty
			if (query) {
				const encodedQuery = encodeURIComponent(query);
				const pathname = window.location.pathname;

				// If first path segment is 2 letters (lang), include it
				const pathLang = pathname.split('/')[1];
				if (pathLang && pathLang.length === 2) {
					window.location.href = `/${pathLang}/search/?q=${encodedQuery}`;
				} else {
					window.location.href = `/search/?q=${encodedQuery}`;
				}
			} else {
				// Show alert in page's language (fallback to Portuguese)
				alert(messages[lang] || messages.pt);
			}
		});
	});

	// Optional: Handle cases where forms might not have been found
	if (searchForms.length === 0) {
		console.warn('No search forms found with the class "search-form".');
	}
});
