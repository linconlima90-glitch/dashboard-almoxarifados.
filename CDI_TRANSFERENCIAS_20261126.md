# Transferências Chuá e atribuição do comparativo — 26/11/2026

## Fonte e conciliação

`potencial_economia_3.csv`, SHA-256 `7ef100317ae3915d59784c5d7463ba19d35031bdc50366d0c8714a0a48aa52fb`, contém338 linhas de08/01/2025 a25/11/2026, todas da empresa3/local30115. Saídas e entradas têm quantidades iguais; não há duplicatas de chave composta, quantidades negativas ou zero.

O recorte do projeto iniciado em07/05/2026 contém228 linhas:184 reapresentadas sem alterações e44 novas, em8 documentos e38 produtos, de10 a25/11. As110 anteriores ao projeto ficam em auditoria. As54 perdas D410 da fonte histórica permanecem separadas, com R$16.678,64 de valor ERP.

O CSV não traz custo, grupo ou sequência do item. As184 correspondências inequívocas conservam ID, sequência e valores ERP históricos: **R$62.779,90 de subtotal conhecido**. As44 novas mantêm valores monetários e sequência ERP `null`. Seus grupos são conciliados por produto+unidade com o cadastro do estoque26/11, sem usar preços atuais como custos históricos. IDs novos usam a chave composta documental, sem sequência inventada.

## Comparativo preservado e atribuição

O comparativo gerencial das441 compras permanece em **R$92.946,18**: compras CDI176/R$65.963,17 e compras diretas265/R$26.983,01. A referência continua sendo o maior custo aprovado da Tabela Custo, com as exceções aprovadas e diferenças negativas preservadas. Transferências não criam benefício adicional.

| Destinação no cenário amplo | Parcela do comparativo |
| --- | ---: |
| Distribuição para outros almoxarifados | R$43.909,93 |
| Consumo identificado da Fazenda Chuá | R$1.793,33 |
| Outras saídas, reserva excluída do ganho de utilização | R$4.479,06 |
| Sem saída vinculada | R$15.780,85 |
| Total CDI | R$65.963,17 |

Das228 transferências,124 têm alguma quantidade de compra anterior atribuída e119 têm referência aprovada para algum benefício. Das44 novas,27 têm vínculo,26 têm referência e17 ficam sem vínculo. A parcela das novas é R$3.949,48 e o custo de compras atribuído é R$7.382,95. Esse custo não preenche o valor ERP ausente na transferência.

No cenário amplo, a distribuição contém R$909,27 ligados a notas com recebimento lançado e R$43.000,66 ligados a pendentes. O cenário que recalcula toda a fila apenas com recebimento lançado produz R$2.882,11 para distribuição e R$9,02 para consumo próprio. Não é apenas um filtro da hipótese ampla: excluir lotes pendentes muda a ordem de utilização.

## Método e limites da evidência

O módulo puro `scripts/cdi-allocation.mjs` utiliza270 compras do30115, R$154.308,69, e901 saídas:228 distribuições,619 baixas e54 perdas. As612 baixas antigas conferem com a base de Dt.Neg.; as7 recentes não preservam centro de uso e ficam como `CONSUMO_NAO_IDENTIFICADO`, sem benefício de consumo próprio.

As filas usam produto+unidade exatos e ordem de data, NUNOTA, sequência e ID. Perdas e outros centros consomem a mesma quantidade disponível, mas sua parcela é reservada fora do benefício elegível. Não há uso de compras futuras. A quantidade e os centavos de cada lote são consumidos uma única vez, com arredondamento acumulado, inclusive nas diferenças negativas.

Não há estoque inicial quantificado nem rastreamento físico de lote. O cenário amplo inclui compras pendentes e admite compras na mesma data da saída, com identificação da hipótese. Status atual de recebimento não informa data/hora de entrada. O residual é saldo documental de compras sem saída vinculada; não equivale ao estoque físico atual. A apuração não certifica economia financeira, demanda evitada ou logística.

São preservadas5 divergências históricas entre fontes, sem documento de retificação:3 linhas da NUNOTA2621567 (base atual menos detalhe antigo:−R$60,08), e2 da NUNOTA2700951 (base atual menos comparativo:R$10,02). Custo atual e custo da base do comparativo ficam separados; o benefício utiliza o último. Há8 compras CDI sem referência disponível, sem criar benefício zero comprovado.

## Integração e verificação

`data/cdi-transfer-update-20261126.b64` guarda o ledger conciliado. `data/cdi-allocation-input-20261126.b64` guarda entradas normalizadas e hashes das fontes. Os importadores geram ledger, apuração e compras30115 em `dist` antes dos bundles rápidos. Alterar uma fonte exige nova conciliação; o build rejeita hashes divergentes.

O painel `cdi-allocation-ui-20261126.js` substitui a apuração congelada09/11, mostra cenários amplo/recebido e permite consultar/exportar as linhas, quantidades e notas. A base de compras30115 passa a270linhas/218SKU-UN, com datas próprias até10/11. O total geral do comparativo, o estoque26/11, as baixas25/11 e os mínimos não são modificados pelo rateio.

A revisão independente em Python com frações exatas conferiu901eventos e270lotes nos três cenários, com412/29/392vínculos, sem divergências de quantidade, custo ou benefício. As diferenças negativas conservam−R$851,05 atribuídos e−R$1.749,57 residuais, total−R$2.600,62. Os testes Node cobrem conservação, perdas, datas, unidades, duplicatas, recebimento, custos ausentes e idempotência. O gate de navegador exige apuração pronta, cenários e reconciliação com os mesmos dados servidos.
