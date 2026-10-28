# Correcao definitiva da navegacao de capital - 28/10/2026

## Bug reproduzido
A partir do Resumo Executivo, em "Onde esta o capital em estoque", clicar em "Local" no breadcrumb do nivel Grupo mudava inesperadamente para a aba "Estoque" (tabela com 4.324 posicoes).

## Causa
O script `executive-interactive.js` ligava o cabecalho completo do painel a `goExact('estoque')`. O script `capital-hierarchy.js` tambem capturava os cliques do breadcrumb no mesmo cabecalho. `stopPropagation()` no segundo manipulador nao bloqueava outros ouvintes ligados ao mesmo elemento, provocando duas acoes em um unico clique. Os testes antigos so verificavam o conteudo do grafico, nao a aba ativa.

## Solucao
- Removido redirecionamento ao estoque quando o titulo e o painel de capital.
- Removido o aspecto visual de titulo clicavel no painel de capital.
- Adicionado `stopImmediatePropagation()` no clique nos breadcrumbs.
- Preservado o clique nos itens da tabela de produtos para abrir o estoque detalhado.
- Acrescentados testes Playwright com cliques de usuario nos botoes `Local` e `Voltar aos locais`, garantindo que a aba `Resumo Executivo` continue ativa e que a lista de almoxarifados reapareca (inclusive apos abrir Produto).

O estoque ERP de 28/10, as baixas, o historico de compras e a regra de minimo de dois meses permanecem inalterados.
