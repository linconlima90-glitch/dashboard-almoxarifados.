# Auditoria de atualizacao de estoque e baixas — 27/11/2026

## Fotografia do estoque (substituicao integral)

- Fonte: Estoques_analitico(20261127-171822).xlsx
- Emissao ERP: 27/11/2026 14:12:32.
- SHA-256 da planilha: 017440c36903404e0b57a32362ebe797373d1bec30274f48dbe6ed15407fcd85
- Chave fiscal: empresa + codigo_local + codigo_produto + unidade.
- 4.440 posicoes sem chave duplicada, 3.679 produtos distintos, 9 locais.
- Valor contábil: **R$ 2.389.252,48** (soma de CUSTO_TOT, centavos linha a linha).
- Saldo anterior ERP: 26/11/2026 10:04:55; 4.450 posicoes e R$ 2.400.279,41.
- Diferenca total de valor: **-R$ 11.026,93**, que NAO pode ser interpretada somente como baixa.
- Cruzamento fiscal por posicao: **2 novas**, **12 removidas**, **101 alteradas** e **4.337 sem alteracao**.
- 20 posicoes com valor contábil zero preservadas conforme a origem.
- Delta auditado em data/stock-delta-20261127.b64, reconstruido no build apos a fotografia de 26/11.
- Nao deduzir movimentacoes do saldo fisico: a fotografia nova ja e o saldo ERP.

## Baixas anteriores, exportadas em 27/11

- Fonte: Conferencia_de_custo_X_baixas_(Fora_a_Transferencia)(20261127-170834).xlsx
- Emissao ERP: 27/11/2026 14:08:21.
- SHA-256 da planilha: 089ad664dcd7c18cb41376d5e8cc7aeac682c30a88ed96118201a4ac69cdd369
- 91 sequencias unicas, sem duplicatas no historico importado; 91 baixas com **Dt.Neg. 26/11/2026**.
- 88 com Dt.Movimento em 26/11 e 3 em 27/11; competência é sempre Dt.Neg.
- **Custo_Total: R$ 5.365,78**; Vlr.Total: R$ 5.365,79. Diferenca de R$ 0,01 mantida.
- 39 registros com placa informada no arquivo.
- Totais historicos esperados apos importacao: 23.010 lancamentos, R$ 2.615.541,11.
- Novembro e parcial: o calculo de estoque minimo continua usando meses completos de 2025 e janeiro-outubro de 2026, com cobertura de 2 meses.
- Nao alterar compras, redistribuicao CDI ou referencia gerencial de custo ao atualizar estas fontes.

## Nota sobre unidade do arame

O novo ERP informa produto 102793, local 50115, como **5.000 MT e R$ 2.419,00**. A normalizacao gerencial aprovada em 26/11 era especifica para a origem antiga de cinco rolos e nao deve ser aplicada de novo. O teste integrado foi atualizado para evitar conversao em dobro.

## Publicacao

O pipeline de regressao e publicacao Cloudflare deve concluir com sucesso antes de declarar a atualizacao disponivel no site.