# Projeto B

O [plano do test-b](LANCAMENTO.md) descreve a modal de continuação: o clique abre o `/v/` do mesmo produto no parceiro. O rewarded real fica no destino. Esse desenho ainda não foi implementado. As pendências de conversão estão no [contrato de medição Google](../adspect/docs/medicao-google.md).

Domínio provisório: `site-b.example`. Stream próprio, com fingerprint e treinamento VLA. Conteúdo e destino independem da classificação Adspect.

Edite a identidade em [site.json](site.json). O código e os assets ficam em `../arb-test-base/`, independente do Clickverso publicado. Mantenha as duas pastas irmãs.

```bash
bun run dev
bun run build
bun run test
bun run setup
bun run report 2026-10-16T00:00:00Z 2026-10-17T00:00:00Z
```

O ambiente local usa a porta **8792**. `build` apenas compila. O stream já foi criado e verificado; seu ID está em `.dev.vars`, fora do Git. A API Key permanece em `../adspect/credentials/secrets.json`.

O Worker e o domínio ainda não foram publicados. Consulte o [guia compartilhado](../arb-test-base/README.md) para instalação, medição e preparação do domínio real.
