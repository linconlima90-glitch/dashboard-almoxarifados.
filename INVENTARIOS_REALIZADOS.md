# Aba Inventários realizados (gestão consolidada)

A nova aba fica em **Estoque > Inventários realizados** e utiliza a hierarquia **Local > Grupo > Produto**. São apresentados o histórico de cada contagem (com data e identificação), saldo do ERP na data do inventário, quantidade física, diferença (contado menos ERP), classificação positiva/negativa/neutra, impacto monetário somente quando houver custo naquela conferência, status e documento do ajuste no ERP.

Cada nova planilha encaminhada deve ser conciliada e adicionada a **public/inventory-audit-data.js**. O arquivo guarda arrays **inventories** e **entries**, nunca substitui registros anteriores.

## Esquema
- `inventories`: `{id,date,sourceFile,description?,responsible?,receivedAt?,notes?}`, data no formato `YYYY-MM-DD`, ID único.
- `entries`: `{id,inventoryId,local,codigoLocal,empresaFiscal,grupo,codigo,produto,un,saldoSistema,saldoContado,custoUnitario?,statusERP?,documentoERP?,observacao?}`. `id` por linha do documento, permitindo o mesmo código em mais de uma empresa fiscal. Cada contagem deve ser numérica e não negativa; vazio nunca se interpreta como zero.
- `statusERP`: `PENDENTE` para diferenças ainda não comprovadamente ajustadas, `CONFIRMADO` para ajustes realizados no ERP, `SEM_DIFERENCA` quando não há ajuste. A confirmação precisa de comprovante.
- Saldos, estoque mínimo e baixas não são modificados automaticamente. O ERP permanece fonte oficial; nova fotografia de estoque substitui saldos, evitando dupla contabilização.

Aba inclui filtros por inventário/data, local, grupo, código, tipo, busca e exportação CSV. O arquivo atual **não contém inventários**, pois nenhum relatório de inventário foi enviado neste pedido. Os inventários anteriores não foram inferidos por comparações de saldos.

Uma vez recebida a primeira planilha com a contagem e os saldos de sistema correspondentes à data da conferência, os itens poderão ser importados, inclusive os sem diferença, preservando datas, empresa fiscal, documento e histórico.
