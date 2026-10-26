import site from '#site';

export default Object.freeze({
	CACHING: true,
	CACHE_CONTROL_TIME: 3600,
	CMS_ENDPOINT: 'https://metacms.highstakes.tech',
	PUBLIC_KEY:
		'BBSIN_16XjPEEKOkcGwLHgnBFPjZgxBjFQHZ_BXn206dP3nzLpU7WryrIgmQ629AIg0rQo9I8Cl51QijEoOnsYk',
	LANGUAGES: ['pt'],
	DOMAIN: site.domain,
	CMS_DOMAIN: site.cms_domain,
	SITE_NAME: site.name,
	SITE_SLOGAN: {
		pt: 'Finanças, cartões e investimentos sem complicação',
	},

	SITE_DESCRIPTION: {
		pt: 'Conteúdo prático sobre cartões de crédito, finanças pessoais, renda passiva, economia e mercado — tudo o que você precisa para organizar o seu dinheiro, investir melhor e decidir com mais segurança.',
	},

	HOME: {
		pt: {
			HEADLINE: 'Entenda o seu dinheiro e faça ele trabalhar por você',
			SUBHEADLINE: 'Guias, análises e dicas sobre cartões, finanças pessoais, renda passiva e mercado financeiro.',
			BUTTOM_1_TEXT: 'Quem Somos',
			BUTTOM_1_LINK: '/s/quem-somos/',
			BUTTOM_2_TEXT: 'Fale Conosco',
			BUTTOM_2_LINK: '/s/contato/',
			CATEGORY_PRETEXT: 'Temas em Destaque',
			CATEGORY_TEXT: 'Cartões, finanças pessoais, renda passiva, economia e mercado em um só lugar',
			LAST_PRETEXT: 'Novos Artigos',
			LAST_TEXT: 'Análises, guias e estratégias sobre finanças e mercado, atualizados periodicamente',
			BOTTOM_TEXT: 'Boas decisões financeiras começam com informação',
			BOTTOM_SUBTEXT: 'Aprenda a usar o crédito, poupar e investir com mais confiança',
			BOTTOM_BUTTOM_TEXT: 'Conheça nossos especialistas',
			BOTTOM_BUTTOM_LINK: '/a/',
		},
	},

	AUTHORS_DESCRIPTION: {
		pt: 'Profissionais de finanças e economia comprometidos em traduzir o mercado, o crédito e os investimentos em orientações práticas para o seu dia a dia.',
	},

	MENU: {
		pt: 
		`<li class="menu__item">
	<a href="/c/economia-e-mercado/">Economia e Mercado</a>
</li>
<li class="menu__item">
	<a href="/c/renda-passiva/">Renda Passiva</a>
</li>
<li class="menu__item">
	<a href="/c/cartoes/">Cartões</a>
</li>
<li class="menu__item">
	<a href="/c/financas-pessoais/">Finanças Pessoais</a>
</li>`,
	},
	// Header texts used as defaults by Template.renderTemplate('header')
	HEADER: {
		pt: {
			LOGO_ALT: `Logo ${site.name} - Finanças, Cartões e Investimentos`,
			MENU_LABEL: 'Menu principal',
			MENU_OPEN_LABEL: 'Abrir menu',
			SEARCH_FORM_LABEL: 'Formulário de busca',
			CARD_BRANDS_TITLE: 'Principais bandeiras',
			CARD_BRANDS: ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard'],
		},
	},
	READ_TIME: {
		pt: 'min de leitura',
	},
	PRELOADER: {
		LOADING: {
			pt: 'Carregando',
		},
		SECURE: {
			pt: 'Site Seguro',
		},
	},
	WRITTEN_BY: {
		pt: 'Por',
	},
	POPULAR_CATEGORIES_TITLE: {
		pt: 'Categorias Populares',
	},
	LOGO_URL: 'https://via.placeholder.com/150',

	FOOTER_LEFT_TITLE: {
		pt: 'Sobre Nós',
	},
	FOOTER_LEFT_MENU: {
		pt: `<li>
	<a href="/s/quem-somos/">Quem Somos</a>
</li>
<li>
	<a href="/a/">Especialistas</a>
</li>
<li>
	<a href="/s/contact/">Contato</a>
</li>`,
	},

	FOOTER_RIGHT_TITLE: {
		pt: 'Informações Legais',
	},

	FOOTER_RIGHT_MENU: {
		pt: `<li>
	<a href="/s/termos-de-uso/">Termos de Uso</a>
</li>
<li>
	<a href="/s/politica-de-privacidade/">Política de Privacidade</a>
</li>
<li>
	<a href="/s/politica-de-cookies/">Política de Cookies</a>
</li>`,
	},

	FOOTER_BOTTOM_MENU: {
		pt: `<li>
	<a href="/s/termos-de-uso/">Termos de Uso</a>
</li>
<li>
	<a href="/s/politica-de-privacidade/">Política de Privacidade</a>
</li>
<li>
	<a href="/s/politica-de-cookies/">Política de Cookies</a>
</li>`,
	},

	ALL_RIGHTS: {
		pt: `Todos os direitos reservados.`,
	},
	SOCIAL_MEDIA: {
		instagram: 'https://www.instagram.com/mejorescreditos/',
		facebook: 'https://www.facebook.com/mejorescreditos/',
	},
	PRO_POINTS_LANGUAGE: {
		pt: 'Pontos Positivos',
	},
	CONS_POINTS_LANGUAGE: {
		pt: 'Pontos Negativos',
	},
	SIDEBAR_TITLE: {
		pt: 'Últimas Notícias',
	},
	RELATED_TITLE: {
		pt: 'Artigos Relacionados',
	},
	CONTACT_DATA: {
		TITLE: {
			pt: 'Contato',
		},
		SUBTITLE: {
			pt: 'Entre em Contato com Nossa Equipe',
		},
		TEXT: {
			pt: 'Nos envie uma mensagem usando o formulário abaixo e nós entraremos em contato o mais rápido possível.',
		},
		PLACEHOLDER_NAME: {
			pt: 'Nome',
		},
		PLACEHOLDER_SUBJECT: {
			pt: 'Assunto',
		},
		PLACEHOLDER_MESSAGE: {
			pt: 'Mensagem',
		},
		BUTTON_TEXT: {
			pt: 'Enviar Mensagem',
		},
		SENDING_MESSAGE: {
			pt: 'Enviando...',
		},
		SUCCESS_MESSAGE: {
			pt: 'Sua mensagem foi enviada com sucesso!',
		},
		SERVER_ERROR_MESSAGE: {
			pt: 'Ocorreu um erro ao mandar sua mensagem.',
		},
		FORM_ERROR_MESSAGE: {
			pt: 'Houve um problema ao mandar sua mensagem. Por favor tente novamente mais tarde.',
		},
		FILL_INPUTS_MESSAGE: {
			pt: 'Preencha todos os campos',
		},
	},
	PAGINATION: {
		NEXT: {
			pt: 'Próxima',
		},
		PREVIOUS: {
			pt: 'Anterior',
		},
	},
	DATE_FORMATS: {
		pt: 'DD/MM/YYYY - HH:mm',
	},
	AUTHORS_LIST_TITLE: {
		pt: 'Conheça Nosso Time',
	},
	AUTHOR_ABOUT_TITLE: {
		pt: 'Sobre o Autor:',
	},
	NOT_FOUND: {
		pt: {
			TITLE: 'Página não encontrada',
			TEXT: 'A URL pode estar incorreta ou a página pode não existir mais.',
		},
	},
	READ_ALSO: {
		pt: 'Leia também...',
	},
	SEARCH: {
		NOT_FOUND: {
			pt: 'Nenhum post encontrado.',
		},
		RESULT: {
			pt: 'Pesquisa',
		},
		ACTION: {
			pt: 'Pesquisar',
		},
		PLACEHOLDER: {
			pt: 'Buscar',
		},
	},
	READ_MORE_TITLE: {
		pt: 'Leia mais',
	},
	POSTS_BY: {
		pt: 'Posts de',
	},
	CATEGORY: {
		pt: 'Categoria:',
	},
	REFERENCES_TITLE: {
		pt: 'Referências',
	},
});
