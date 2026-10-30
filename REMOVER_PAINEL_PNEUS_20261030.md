# Remoção do bloco inferior de pneus e câmaras

Solicitação: retirar da página de **Resumo Executivo** o quadro inferior "Estoque de pneus e câmaras", com seus indicadores e a tabela de almoxarifados.

Implementação: removido o carregamento do script `/tire-stock-dashboard-20260930.js` no `src/index.js`. O arquivo de origem fica preservado no repositório, mas não é carregado em nenhuma das páginas do dashboard.

**Não exclui** pneus, câmaras, produtos, saldos, preço, histórico de compras ou filtros de Estoque. A política de reposição/estoque mínimo de dois meses permanece inalterada.

Também foi corrigida uma falha de validação do estoque mínimo das fazendas: para linhas com **média zero e total de baixas zero**, o mínimo e a necessidade ficam zero. A tela não pode sugerir compra sem consumo demonstrado. Mantidas as demais regras de mínimo de dois meses.

Adicionado teste de regressão visual/DOM para garantir que o painel não exista e que os pneus continuem disponíveis na base STOCK.
