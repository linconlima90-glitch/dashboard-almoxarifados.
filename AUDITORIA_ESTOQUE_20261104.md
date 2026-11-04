# Estoque ERP de 04/11/2026 07:43:16 - importacao pendente

Fonte: `Estoques_analitico(2).xlsx`. SHA-256: `9b68a22e8e254cac476af580ca1ecb9a57f72ece3399038a4adfc4c9683f23f9`.

- 4.303 registros em 9 almoxarifados, total de R$ 2.247.711,47.
- Posicao anterior de 03/11/2026 15:58:21: 4.304 registros, R$ 2.249.087,15.
- Variacao liquida: -1 posicao, -R$ 1.375,68. Nao converter essa variacao em baixa nem somar snapshots.
- Cod. 106763 / local 50115 tem duas linhas em empresas fiscais distintas: 1 PC (R$ 65,00) e 2 PC (R$ 130,00); preservar ambas.
- Saldo ERP integral; nunca subtrair novamente baixas do historico.
- Estoque minimo de 2 meses com baixas de jan/2025 a out/2026 (22 meses completos), excluindo pneus/camaras/cimento da reposicao.
- As baixas de 03/11/2026 recebidas em 04/11 estao auditadas separadamente, sem atualizacao publicada no painel.

**Estado:** AUDITADO, NAO PUBLICADO. O arquivo compactado preparado para a substituicao precisa ser transferido ao repositorio e conectado ao build, seguido de regressao e deploy. Este documento nao altera saldos no dashboard.
