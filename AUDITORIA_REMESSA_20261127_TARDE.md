# Auditoria de atualização complementar — 27/11/2026, 17h20

## Estoque (fotografia integral substitutiva)
- Planilha: Estoques_analitico(20261127-202046).xlsx
- Emissão ERP: 27/11/2026 17:20:00
- SHA-256: 5244226ef4bfb9e01aadc8981ca048b4c5976e4c85b38cf81781e7b54904aa39
- 4.439 posições únicas, 3.678 produtos, 9 locais, **R$ 2.387.311,04**
- Em relação à fotografia das 14h12: 1 posição nova, 2 removidas, 42 alteradas, 4.396 sem alteração.
- Variação do valor total: -R$ 1.941,44. Não atribuir essa diferença somente às baixas.
- Chave fiscal: empresa + código local + código produto + unidade. O saldo físico já incorpora as movimentações lançadas no ERP: nunca subtrair baixas mais uma vez.

## Baixas (importação incremental)
- Planilha: Conferencia_de_custo_X_baixas_(Fora_a_Transferencia)(20261127-201819).xlsx
- Emissão ERP: 27/11/2026 17:16:21
- SHA-256: 2fdd8b679a00b1bac53d93f9efefb345772f7ddc004b3ad4bc2d4e5d638183e7
- 91 registros com Dt.Neg. em 27/11/2026; sem choque com as 91 linhas anteriores por Dt.Neg. em 26/11/2026.
- Custo_Total: **R$ 11.117,01**, Vlr.Total: **R$ 11.117,04**, diferença de R$ 0,03 preservada.
- 47 registros possuem placa na planilha fonte.
- Totais ERP acumulados esperados: 23.101 lançamentos e R$ 2.626.658,12.
- Competência de estoque mínimo: meses encerrados de janeiro/2025 a outubro/2026; novembro permanece parcial.
- Não alterar compras, distribuição CDI ou preços gerenciais autorizados durante esta atualização.

## Publicação
A edição do repositório apenas dispara os testes e o fluxo de publicação, devendo a execução de CI e o deployment Cloudflare ser verificados separadamente.
