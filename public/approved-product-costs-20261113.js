// Referencias de custos gerenciais explicitamente autorizadas para o dashboard.
// Nao sobrescrever valores originais de NF, historico de baixas ou ERP.
(function(){
  'use strict';
  const corrections={
    '124928':Object.freeze({
      codigo:'124928',
      produto:'CORREIA HXE46027',
      unidade:'PC',
      custoUnitario:7982.58,
      custoMicro:7982580000,
      dataAprovacao:'2026-11-13',
      abrangencia:'Todos os almoxarifados e paineis gerenciais do dashboard',
      fonte:'Orientacao expressa do gestor: alterar custo da CORREIA HXE46027 para R$ 7.982,58 em todos os locais',
      origemErpPreservada:true,
      historicoComprasPreservado:true
    })
  };
  window.DB_APPROVED_PRODUCT_COSTS=Object.freeze(corrections);
})();
