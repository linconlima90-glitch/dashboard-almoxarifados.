# Navegação de capital por local e grupo — 28/10/2026

Solicitação: no **Resumo Executivo → Onde está o capital em estoque**, após escolher um almoxarifado e visualizar os grupos, permitir clicar em **Local** para retornar ao resumo anterior por almoxarifado.

Alteração: o breadcrumb **← Local** passa a ter destaque e tooltip de retorno. Um botão adicional **← Voltar aos locais** aparece junto ao valor total dos grupos e também na lista de produtos. Ambos retornam à visualização com todos os almoxarifados, sem modificar filtros do estoque, saldos, compras, baixas ou a regra de mínimo de dois meses. O clique na barra continua levando de Local para Grupo e de Grupo para Produto.

Validação automatizada: percurso Local → Grupo → Local por breadcrumb; Local → Grupo → Local pelo botão; Local → Grupo → Produto → Local pelo botão.
