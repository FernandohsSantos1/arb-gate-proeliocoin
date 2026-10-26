# arb-gate-proeliocoin

O [plano técnico GDN do Proeliocoin](LANCAMENTO.md) define tratamento ativo da análise Adspect: negado mantém a safepage local; liberado abre uma modal própria de continuação, com interface e textos próprios do projeto. O clique abre o `/v/` do mesmo produto no parceiro; fechar mantém o artigo local. A modal informa a saída para o parceiro, sem apresentação de anúncio ou promessa de recompensa. O rewarded real fica no destino. A safepage mantém conteúdo real e a oferta acessível, sem ocultá-la de revisores. O motor de fechamento, teclado e foco foi testado isoladamente no navegador. A integração técnica com o Worker foi preparada com configuração simulada; a interface real ainda depende da identidade e dos textos finais. Configuração de campanha e ações de conversão fica fora da implementação. O [contrato de medição Google](../adspect/docs/medicao-google.md) distingue os eventos, o transporte de parâmetros GDN e as dependências externas.

Domínio definido pelo usuário: `proeliocoin.com`. `arb-gate-proeliocoin` identifica a pasta, o stream e a configuração do futuro Worker. Nome visual, identidade e template ainda serão definidos. O stream mantém seu ID, com fingerprint e treinamento VLA. O perfil real permanece em observação. A integração técnica aplica o resultado quando configurada e ativada; não alterar `observe_only` antes das decisões pendentes.

O código, os assets, as dependências e os testes ficam nesta pasta. O B não importa código da base, do CheersToSochi ou do Clickverso. A identidade fica em [site.json](site.json); ainda usa os valores visuais provisórios herdados e precisa da decisão do usuário.

O catálogo usa 12 artigos publicados do próprio `proeliocoin.com` no Meta Offers, cadastro de domínio `336`, com quatro produtos em cada idioma (`pt`, `en` e `es`). Cada entrada valida domínio, ID, produto, oferta, idioma e slug da origem. As URLs anteriores continuam como aliases do mesmo curso; a canônica usa o slug do registro próprio. As 12 capas também vêm desse cadastro e têm arquivos locais no manifest. A origem editorial local é independente do parceiro de saída: o resolver consulta o inventário do pool e preserva o produto. O transporte dos seis campos GDN foi testado no adaptador e na navegação. O clique da modal consulta `/go/`. Sem configuração explícita de textos, `/go/` retorna 503 e não consulta o pool.

```bash
bun install --frozen-lockfile
bun run dev
bun run build
bun run test
bun run test:inherited
bun run test:runtime
bun run test:browser
bun run test:modal
bun run setup
bun run report 2026-10-16T00:00:00Z 2026-10-17T00:00:00Z
```

O ambiente local usa a porta **8792**. `build` apenas compila. O ID do stream existente está em `.dev.vars`, fora do Git, e coincide com o cadastro central. A leitura de 22/10 confirmou fingerprint e `noop`, mas encontrou `mode='Review'`, divergente de `Filter`. A API Key permanece em `../adspect/credentials/secrets.json`.

`test:inherited` executa regressões de conteúdo, análise, fingerprint e POST com site e catálogo de fixture isolados. As expectativas do loader, da política antiga e da saída pelo High Offers foram retiradas; os caminhos antigos não fazem parte do runtime B. Esses testes não comprovam o perfil real do B.

Os testes de catálogo cobrem os 12 registros próprios, seus aliases e os templates reais, incluindo GET e HEAD. Os testes de conteúdo, transporte GDN, resolução de produto, rejeição de POST e controlador de navegação passam. A suíte própria completa ainda tem 11 falhas nas expectativas do gate, da modal e da home, anteriores à troca de origem. O bundle Wrangler real passa. Esses resultados não comprovam o funcionamento completo do gate.

`test:runtime` compila o perfil real sem publicá-lo e depois executa o workerd com configuração de continuação e imagens simuladas. Esse segundo perfil passou por GET, dois POSTs de fingerprint, negação, HEAD sem análise e resolução após clique. A saída identifica a simulação e não valida as capas ou a configuração real. As fixtures de navegador preservam esse marcador. O cancelamento no navegador real ainda precisa ser conferido.

O [roteiro do stream B](LANCAMENTO.md#roteiro-do-stream-b-e-da-integração) detalha sua conferência e integração. `setup` pode criar stream quando faltar o cadastro e sobrescreve `.dev.vars`; não é uma consulta somente de leitura. A validação compara valores efetivos: definir os mesmos campos manualmente equivale a aplicar um preset, sem exigir prova de seu uso na criação.

O Worker B ainda não foi publicado nem associado a `proeliocoin.com`. DNS e TLS não foram conferidos nesta preparação. A publicação exige assets e namespace KV próprios; não reutilizar os recursos do A ou do Clickverso. Os contratos de integração e medição ficam no [plano deste projeto](LANCAMENTO.md).
