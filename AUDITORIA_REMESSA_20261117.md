# Auditoria de estoque e baixas - 17/11/2026

Fontes:
- `Estoques_analitico(8).xlsx`, emitido em 17/11/2026 17:23:25. Fotografia substitutiva integral do ERP.
- `Conferencia_de_custo_X_baixas_(Fora_a_Transferencia)(20261117-202402).xlsx`, emitido em 17/11/2026 17:21:37. Periodo de negociacao: 13/11/2026 a 17/11/2026.

## Totais ERP

- Estoque: 4.428 posicoes, 9 locais, R$ 2.432.567,70. Saldo deve substituir a fotografia de 12/11, nunca sofrer deducao adicional pelas baixas.
- Baixas: 288 linhas novas, R$ 15.349,95 em `Custo_Total`, R$ 15.292,61 em `Vlr.Total`.
- Datas por negociacao: 13/11 (83), 14/11 (18), 16/11 (101), 17/11 (86). Nao houve baixa negociada em 15/11 no arquivo.
- Deduplicacao por `Nro.Unico + Seq.`: nenhuma duplicidade na remessa.
- Conferencia: 282 baixas com status IGUAL e 6 com status DIFERENTE. A soma da diferenca dos dois valores e R$ 57,34; comparar como grandezas distintas, nao misturar na serie de custo.

## Estoque por local

| Cod.Local | Posicoes | Valor (R$) |
|---|---:|---:|
| 50115 | 2.489 | 1.442.646,89 |
| 10114 | 418 | 301.223,59 |
| 30115 | 693 | 289.597,44 |
| 570115 | 456 | 214.697,53 |
| 20115 | 158 | 75.175,89 |
| 20122 | 106 | 59.373,80 |
| 10150 | 62 | 39.602,61 |
| 510122 | 40 | 8.695,05 |
| 160115 | 6 | 1.554,90 |

## Excecoes para auditoria

- Diferenca de custo de rolamentos e fita isolante (6 linhas com status DIFERENTE). Nao corrigir automaticamente o custo registrado pelo ERP.
- Codigo 106763, local 50115, aparece em duas empresas fiscais distintas (Fazenda Sao Joao e Saco Sao Francisco). Sao posicoes distintas pela chave fiscal completa; nao excluir nenhuma como duplicidade.
- Codigo 124928 (CORREIA HXE46027): custo do snapshot ERP no local 570115 e R$ 9.391,27, enquanto a referencia gerencial explicitamente autorizada em 13/11/2026 e R$ 7.982,58. Preservar ambos, mantendo referencia gerencial sem alterar a fonte ERP.
- O ERP apresenta custo unitario arredondado a centavos e custo total calculado com mais precisao em diversos itens; nao substituir `CUSTO_TOT` por `ESTOQUE * CUSTO_UNIT`.

## Regras de aplicacao

- Baixas: agrupar pela data de negociacao; preservar historico anterior sem relancar periodos anteriores.
- Estoque minimo: dois meses de cobertura; usar apenas os meses completos de 2025 e janeiro-outubro de 2026 para a media. Novembro parcial aparece no historico, mas fica fora da media.
- Excluir pneus, camaras e cimento das necessidades de estoque minimo, conforme politica vigente.
- Nao confundir movimentacoes de transferencias com economia comprovada.
