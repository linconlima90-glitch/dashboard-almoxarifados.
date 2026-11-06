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

## Regra de compras para distribuição (06/11/2026)
**Orientação expressa:** toda compra destinada ao estoque do **local ERP 30115** deve ser considerada **compra para distribuição a outras unidades**, a partir da aprovação do CDI em **07/05/2026**, independentemente da empresa que realizou a compra. Esta classificação não significa transferência realizada nem economia.

Relatório-base: `COMPRAS_DE_INSUMOS_POR_LOCAL(2).xlsx`, emitido em 06/11/2026 às 15:24:41, SHA-256 `20d81ba16bdd3099db6e7461872581a9eed98d8504ab703e72ff855a5b20bf77`. Foram conferidos **256 lançamentos de compras para estoque (TOP 89)**, todos destinados ao código de local `30115`, entre 07/05 e 05/11/2026, somando **R$ 150.194,67**. São 208 combinações código+unidade, 14 grupos, 20 fornecedores; 44 linhas com status `LANC.RECEB.` e 212 com `NÃO LANC.RECEB.`, sem presumir recebimento físico a partir dos status. 2 linhas têm empresa compradora São João, mas destino é 30115: a regra se baseia no **local de estoque**, não na empresa compradora.

Os valores ficam resumidos em `public/cdi-distribution-purchases.js` (grupos e meses, com trilha da fonte). O arquivo original do relatório permanece necessário para o futuro cruzamento **linha a linha** com as transferências; o resumo **não contém as 256 linhas completas**, e não deve ser confundido com cópia integral do relatório. Quando houver novas compras TOP 89 para o mesmo local, incluir no histórico a partir dessa data, conciliando por identificador de documento, sequência, produto e unidade, sem duplicar lançamentos. **Não calcular economia a partir de compras isoladas**; a economia só será comprovada quando houver comparativo de alternativa de compra e documento de transferência correspondente.
