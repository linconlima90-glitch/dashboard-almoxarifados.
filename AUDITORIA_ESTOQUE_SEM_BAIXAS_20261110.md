# Auditoria integral da aba Estoque sem baixas — 10/11/2026

**Resultado:** foram comparadas as 4.380 posições físicas do estoque de 09/11/2026 10:29:10 com as **22.019 baixas não transferências**, identificadas por `NroUnico+Sequencia`, com data de referência `Dt.Neg.` entre **14/03/2024 e 09/11/2026**.

| Situação auditada | Posições | Valor em estoque |
|---|---:|---:|
| Sem baixa no próprio almoxarifado | 2.637 | R$ 1.386.701,30 |
| Dentro dessas, com baixas em outros locais | **342** | **R$ 121.530,19** |
| Sem nenhuma baixa em toda a rede conhecida | **2.295** | **R$ 1.265.171,11** |
| Posições corrigidas pelas baixas de 09/11 (todas São João) | 12 | R$ 4.539,34 |

A lista anterior tinha 2.649 posições sem baixa local e valor R$ 1.391.240,64. Todas as 2.649 foram verificadas, foram removidas as 12 posições com baixa de 09/11, **não houve outras classificações locais indevidas** segundo o histórico consolidado.

**Importante:** “sem baixa neste almoxarifado” não significa “nunca utilizado na rede”. A visualização padrão do dashboard passa a usar **sem baixa em toda a rede**, preservando a opção explícita de visualizar ausência de consumo no próprio almoxarifado para realocação. Os 342 materiais utilizados em outras unidades continuam consultáveis nessa opção, mas não na lista padrão de não utilizados em toda a rede.

## Fontes / escopo

- `Base_baixas_data_negociacao.csv` — 21.792 registros, substituindo 28 baixas de 06/11 retificadas.
- `Baixas_ERP_06_a_07-11-2026_conferidas.xlsx` — 147 baixas de 06/11 e 16 de 07/11, ambas com custo ERP.
- `Conferencia_de_custo_X_baixas_(Fora_a_Transferencia)(20261110-135522).xlsx` — 92 baixas de 09/11; R$ 5.532,78; 92 documentos+sequências únicos.
- `Conferencia_Estoque_Sem_Baixas_09-11-2026.xlsx` — universo do saldo ERP 09/11, 4.380 posições, R$ 2.292.215,23.
- Identificação física: empresa fiscal + código do local + código do produto + unidade.
- Teste de baixa local: código local + código produto (qualquer unidade de baixa).
- Teste de baixa na rede: código produto em qualquer local registrado.
- Não há inferência de ausência absoluta de consumo anterior a 14/03/2024 nem posterior a 09/11/2026; transferências não são consumo.
- Não alterar saldo físico (baixas já estão refletidas no ERP) e manter média do mínimo em 22 meses completos (2025 e jan-out 2026).
