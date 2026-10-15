# Aba Estoque sem baixas — 15/10/2026

## Critério
- Somente produtos com saldo positivo em cada almoxarifado e sem baixas **registradas** no histórico local disponível (desde janeiro de 2025 até 15/10/2026, com julho–outubro de 2026 reconciliados).
- Opção separada para exigir inexistência de baixas do produto **em toda a rede**, por código.
- Produtos com histórico pendente de conciliação ou baixas em unidade diferente são excluídos da lista para evitar conclusões de ausência de movimentação sem evidência.
- Pneus, câmaras, lubrificantes e cimento podem ser listados como estoque sem baixas; isso não altera suas regras próprias de reposição e estoque mínimo (2 meses).
- A aba não muda saldos, compras, consumos, comparativos nem filtros das outras telas.

## Colunas
Código e produto, grupo, empresa, almoxarifado, quantidade e unidade, valor em estoque, última compra encontrada (data NF, fornecedor, quantidade, preço, nota fiscal, local da compra) e histórico completo de compras por código + unidade (expandível).
A data individual de **entrada física** não está disponível no arquivo de compras e não é inventada. A data da posição de estoque (15/10/2026) é mostrada separadamente.

## Usabilidade
Padrão: maior valor em estoque primeiro. Ordenações por quantidade (com unidade explícita) e data da última compra; filtros por local, grupo, escopo e pesquisa. Tabela paginada em lotes de 100 com exportação CSV de todos os registros filtrados. Dados indexados apenas ao abrir a nova aba para preservar carregamento rápido.

## Fontes
Estoque e baixas: posição e relatório de 15/10/2026; compras: histórico atualizado até 08/10/2026, incluindo as 264 linhas líquidas adicionadas na última atualização, preservando histórico anterior.
