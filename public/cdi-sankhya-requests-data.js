(function(){
  'use strict';
  // Historico de solicitacoes Sankhya recebido por PDF. Cada nova remessa e acrescentada aqui;
  // nunca substituir solicitacoes anteriores. Identificar por numero unico.
  window.DB_CDI_REQUESTS_DATA = {
    schemaVersion: 1,
    lastImport: '2026-11-13',
    destination: {
      companyCode: '003',
      company: 'DECIO BRUXEL E OUTROS - FAZENDA CHUA',
      localCode: '30115',
      warehouse: 'CDI DE PECAS - FAZENDA CHUA',
      costCenter: '0301.52.17 - ALMOXARIFADO FAZENDA CHUA'
    },
    policy: {cadenceMonths: 2, alertBeforeDays: 15, basis: 'data_de_emissao_da_solicitacao'},
    requests: [
      {
        requestNumber: '110998',
        uniqueNumber: '2720604',
        quotationNumber: '106378',
        issuedAt: '2026-11-12',
        group: 'CORREIAS',
        requestedBy: 'LINCON',
        buyer: 'ALMIR SOARES',
        purchaseType: 'NORMAL',
        documentType: 'SOLICITACAO DE COMPRA',
        sourceFile: 'Reposição de Correias.pdf',
        destinationLocal: '30115',
        destinationCompany: '003',
        status: 'SOLICITACAO EMITIDA',
        note: 'REF. MATERIAL PARA REPOSICAO ESTOQUE CDI DE PECAS FAZ. CHUA.',
        pricesReported: false,
        items: [
          {code:'105098',description:'CORREIA A-47',unit:'PC',quantity:2},
          {code:'105224',description:'CORREIA A-48',unit:'PC',quantity:4},
          {code:'108411',description:'CORREIA A-49',unit:'PC',quantity:3},
          {code:'105106',description:'CORREIA A-62',unit:'PC',quantity:5},
          {code:'111669',description:'CORREIA A-63',unit:'PC',quantity:4},
          {code:'115220',description:'CORREIA B-108',unit:'PC',quantity:4},
          {code:'111721',description:'CORREIA B-44',unit:'PC',quantity:2},
          {code:'111665',description:'CORREIA B-51',unit:'PC',quantity:12},
          {code:'118125',description:'CORREIA B-52',unit:'PC',quantity:8},
          {code:'131462',description:'CORREIA B-53',unit:'PC',quantity:2},
          {code:'111726',description:'CORREIA B-54',unit:'PC',quantity:4},
          {code:'115395',description:'CORREIA B-56',unit:'PC',quantity:1},
          {code:'105097',description:'CORREIA B-57',unit:'PC',quantity:5},
          {code:'104384',description:'CORREIA B-62',unit:'PC',quantity:2},
          {code:'105135',description:'CORREIA B-68',unit:'PC',quantity:10},
          {code:'110147',description:'CORREIA B-69',unit:'PC',quantity:3},
          {code:'104388',description:'CORREIA B-79',unit:'PC',quantity:3},
          {code:'124144',description:'CORREIA B-83',unit:'PC',quantity:2}
        ]
      },
      {
        requestNumber: '111044',
        uniqueNumber: '2720710',
        quotationNumber: '106424',
        issuedAt: '2026-11-12',
        group: 'FERRAMENTAS',
        requestedBy: 'LINCON',
        buyer: 'ALMIR SOARES',
        purchaseType: 'NORMAL',
        documentType: 'SOLICITACAO DE COMPRA',
        sourceFile: 'reposição feramentas.pdf',
        destinationLocal: '30115',
        destinationCompany: '003',
        status: 'SOLICITACAO EMITIDA',
        note: 'REF. MATERIAL PARA REPOSICAO ESTOQUE CDI DE PECAS FAZ. CHUA.',
        pricesReported: false,
        items: [
          {code:'107243',description:'DISCO CORTE 7 X 1.6 X 22.2MM',unit:'UN',quantity:400},
          {code:'135275',description:'DISCO DE CORTE DIAMANTADO TURBO DIAMANTE AZUL 7"',unit:'UN',quantity:5},
          {code:'146099',description:'DISCO DE CORTE TURBO PORCELANATO 4.1/2"',unit:'UN',quantity:5},
          {code:'119543',description:'DISCO DE CORTE TURBO SECO DIAMANTE AZUL 4.1/2"',unit:'UN',quantity:8},
          {code:'115403',description:'DISCO DE CORTE 10" X 1/8 X 5/8',unit:'UN',quantity:25},
          {code:'136301',description:'DISCO DE DESBASTE 7 X 1/4 X 7/8"',unit:'UN',quantity:50},
          {code:'101192',description:'DISCO DIAMANTADO TURBO SECO 4.3/8" - 110MM',unit:'UN',quantity:3},
          {code:'136300',description:'DISCO FLAP CONICO 7/8 X 4.1/2" GRAO 40',unit:'UN',quantity:20},
          {code:'137140',description:'DISCO FLAP CONICO 7/8 X 7" GRAO 60',unit:'UN',quantity:40},
          {code:'105551',description:'FITA ISOLANTE 10MT',unit:'PC',quantity:20}
        ]
      },
      {
        requestNumber: '110546',
        uniqueNumber: '2716745',
        quotationNumber: '105926',
        issuedAt: '2026-11-06',
        group: 'ROLAMENTOS',
        requestedBy: 'LINCON',
        buyer: 'ALMIR SOARES',
        purchaseType: 'NORMAL',
        documentType: 'SOLICITACAO DE COMPRA',
        sourceFile: 'reposição rolamentos.pdf',
        destinationLocal: '30115',
        destinationCompany: '003',
        status: 'SOLICITACAO EMITIDA',
        note: 'REF. REPOSICAO ESTOQUE DE ROLAMENTOS FAZ. CHUA, FORAM TRANSFERIDOS MUITOS PARA MANUTENCAO QUE VAI TER NA FAZENDA, POR ISSO PRECISAMOS REPOR-',
        pricesReported: false,
        items: [
          {code:'123231',description:'ROLAMENTO F110415.01',unit:'PC',quantity:5},
          {code:'102911',description:'ROLAMENTO 6004',unit:'UN',quantity:6},
          {code:'104371',description:'ROLAMENTO 6007',unit:'PC',quantity:4},
          {code:'100410',description:'ROLAMENTO 6205',unit:'PC',quantity:50},
          {code:'100411',description:'ROLAMENTO 6206',unit:'PC',quantity:20},
          {code:'100412',description:'ROLAMENTO 6208',unit:'PC',quantity:15}
        ]
      }
    ]
  };
})();
