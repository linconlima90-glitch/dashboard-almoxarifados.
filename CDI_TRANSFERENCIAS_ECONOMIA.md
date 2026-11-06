# Controle de transferências do CDI – economia a partir de 07/05/2026

## Marco do projeto
Em 07/05/2026 foi aprovado pela diretoria o projeto CDI de peças. O painel **Resumo > Visão geral** disponibiliza um módulo independente "Economia com transferências do CDI para outras unidades", inicialmente **Aguardando planilha**.

## Dados esperados para importação
Arquivo de transferências (Excel). Identificar cada linha por ID único e informar, quando disponível:
- **Data da transferência** (data ERP, não data de lançamento da planilha; a partir de 07/05/2026, inclusive);
- **Documento da transferência** (por exemplo, identificador TOP 94, se aplicável);
- **Origem CDI** (com distinção do almoxarifado físico Chua, ainda que compartilhem o local no ERP);
- **Almoxarifado ou fazenda de destino**;
- **Grupo, código do produto, descrição e unidade**;
- **Quantidade efetivamente transferida**;
- **Custo unitário do produto no CDI** na data da transferência;
- **Preço alternativo da compra que seria necessária** (cotação/compra equivalente, com origem/data);
- **Custo adicional da transferência**, incluindo frete se houver (registrar 0 explicitamente quando comprovadamente inexistente);
- **Comprovação de que a transferência substituiu a compra**, com evidências/documentos.

Base mantida em `public/cdi-transfer-data.js`: `window.CDI_TRANSFER_LEDGER={schemaVersion:1,approvalDate:'2026-05-07',updatedAt,sourceFiles,transfers:[]}`.
Cada transferência inclui: `id`, `date` (ISO `YYYY-MM-DD`), `document`, `origin`, `destination`, `group`, `code`, `product`, `unit`, `quantity`; opcionais `cdiUnitCost`, `alternativePurchasePrice`, `transferCost`, `evidence` e `reviewStatus` (`PENDENTE` ou `VALIDADO`).

## Indicadores
1. **Linhas de transferência**: posições importadas sem duplicidade de ID.
2. **Valor transferido (custo CDI)**: quantidade × custo unitário CDI; é movimentação de patrimônio, não economia.
3. **Compras alternativas (referência)**: quantidade × preço comprovado de compra alternativa; comparação hipotética, não gasto realizado.
4. **Economia comparativa validada**: quantidade × (preço alternativo − custo CDI) − custo adicional da transferência, **somente** com todas as bases informadas, evidência documentada de compra evitada e `reviewStatus='VALIDADO'`. Diferenças negativas são mantidas.

**Não confundir valor de estoque movimentado, desembolso de compras evitadas e economia econômica comprovada.** Transferências internas não devem entrar em "baixas de consumo" nem alterar os saldos físicos da última fotografia ERP, e este indicador não deve ser somado ao potencial estimado de economia em compras. Uma planilha sem preço alternativo pode preencher as transferências sem inventar valores econômicos.

Ao receber o relatório, conciliar duplicidades, origens, destinos, datas e unidades com os documentos ERP antes de atualizar a base. O módulo valida a data mínima, unidades e status; há filtros por ano, destino, grupo e produto, busca, detalhamento e exportação CSV.
