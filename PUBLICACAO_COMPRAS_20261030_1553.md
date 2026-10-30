# Compras de materiais outubro/2026 — posição de 30/10/2026 15:53:46

Fonte: `COMPRAS_DE_INSUMOS_POR_LOCAL(1).xlsx`, arquivo com SHA-256 `6a6a426bcf8a95c4947aff4afc0d4ececbd104f53fdbc2baebf177aa7bb43d26`. O relatório contém somente **01 a 29/10/2026**, portanto não é fechamento de 31/10.

- **137 linhas, R$ 64.843,17** de `Vlr.TotalCusto`, 33 fornecedores e 6 locais (90 linhas `LANC.RECEB.`, 47 linhas `NÃO LANC.RECEB.`).
- A base anterior de outubro até 22/10 tinha **106 linhas, R$ 47.308,90**. Todas as 106 identidades de compra permanecem no novo arquivo; **31 novas linhas** (R$ 17.723,80) e **4 linhas corrigidas** (ajuste financeiro total -R$ 189,53), sem excluir linhas anteriores.
- Diferença entre fotografias de outubro: **+31 linhas, +R$ 17.534,27**. Não interpretar a diferença integral como novas compras: parte vem de correções.
- A carga de outubro foi **substituída**, não somada. Identidade: `Nrounico|Seq|Codprod|CodLocal`, 137 chaves distintas.
- Agosto preservado: 207 linhas, R$ 114.940,11. Setembro preservado: 258 linhas, R$ 153.097,46. Total de agosto a 29/10: **602 linhas, R$ 332.880,74**.
- A aba de variações de preços, economia e fornecedores será recalculada pelo `purchase-update.js` com o histórico consolidado.
- **Não** adicionar automaticamente essas compras ao saldo de estoque (posição ERP de 30/10 15:17:37), e não presumir recebimento físico com base na data da nota.
- O relatório inclui um local novo em relação às compras de outubro anteriores: `DEPOSITO MEDICAMENTOS F SJ`. Trata-se de local de compras, não necessariamente de posição positiva no estoque atual.

## Resumo por almoxarifado
| Local | Itens | Valor R$ |
|---|---:|---:|
| ALMOXARIFADO OFICINA CAMINHOES PATOS | 37 | 21223.16 |
| ALMOXARIFADO GERAL F CHUA | 52 | 19380.59 |
| ALMOXARIFADO GERAL F SJ | 38 | 17796.31 |
| ALMOXARIFADO GERAL F B RETIRO | 2 | 3593.34 |
| DEPOSITO MEDICAMENTOS F SJ | 2 | 1432.05 |
| ALMOXARIFADO GERAL F S TAPERA | 6 | 1417.72 |

## Correções encontradas no ERP
- Nota 83176, item 1, produto 134841 (ABRACADEIRA NYLON 280MM), local ALMOXARIFADO GERAL F CHUA: R$ 37.33 -> R$ 49.69, preço unitário R$ 0.37 -> R$ 0.50.
- Nota 83176, item 4, produto 134841 (ABRACADEIRA NYLON 280MM), local ALMOXARIFADO GERAL F CHUA: R$ 37.33 -> R$ 49.69, preço unitário R$ 0.37 -> R$ 0.50.
- Nota 12905, item 1, produto 100967 (PNEU 12.4 R24), local ALMOXARIFADO GERAL F SJ: R$ 2850.00 -> R$ 2638.54, preço unitário R$ 1425.00 -> R$ 1319.27.
- Nota 18342, item 2, produto 111665 (CORREIA B-51), local ALMOXARIFADO GERAL F S TAPERA: R$ 120.00 -> R$ 117.21, preço unitário R$ 20.00 -> R$ 19.54.

Validação de publicação: testes de 137 identidades exclusivas, valor outubro R$ 64.843,17, totais históricos, atualização da tela e preservação de saldos e baixas.
