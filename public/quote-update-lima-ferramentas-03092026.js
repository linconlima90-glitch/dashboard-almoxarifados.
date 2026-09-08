// Orçamento Lima Ferramentas - 03/09/2026
(function(){
  if (typeof QUOTES === 'undefined') return;
  const rows=[
    {data:'03/09/2026',fornecedor:'Lima Ferramentas',codigo:107243,produto:'DISCO CORTE 7 X 1.6 X 22.2MM',grupo:'FERRAMENTAS',un:'UN',marca:'STARRET',qtd:997,valor_unit:6.00,valor_total:5982.00,validade:'',proposta:'COTACAO SERRALHERIA 03-09',id:'LIMA-03092026-01',arquivo:'Cotacao_serralheria_fornecedores db- 03-09 (2).xlsx'},
    {data:'03/09/2026',fornecedor:'Lima Ferramentas',codigo:136331,produto:'DISCO CORTE 4.1/2X1.0X7/8',grupo:'FERRAMENTAS',un:'UN',marca:'STARRET',qtd:740,valor_unit:3.00,valor_total:2220.00,validade:'',proposta:'COTACAO SERRALHERIA 03-09',id:'LIMA-03092026-02',arquivo:'Cotacao_serralheria_fornecedores db- 03-09 (2).xlsx'},
    {data:'03/09/2026',fornecedor:'Lima Ferramentas',codigo:136300,produto:'DISCO FLAP CONICO 7/8 X 4.1/2" GRAO 40',grupo:'FERRAMENTAS',un:'UN',marca:'STARRET',qtd:235,valor_unit:8.00,valor_total:1880.00,validade:'',proposta:'COTACAO SERRALHERIA 03-09',id:'LIMA-03092026-03',arquivo:'Cotacao_serralheria_fornecedores db- 03-09 (2).xlsx'},
    {data:'03/09/2026',fornecedor:'Lima Ferramentas',codigo:108189,produto:'DISCO CORTE 4.1/2 X 1/8 X7/8',grupo:'FERRAMENTAS',un:'UN',marca:'KRONOS',qtd:48,valor_unit:5.00,valor_total:240.00,validade:'',proposta:'COTACAO SERRALHERIA 03-09',id:'LIMA-03092026-04',arquivo:'Cotacao_serralheria_fornecedores db- 03-09 (2).xlsx'},
    {data:'03/09/2026',fornecedor:'Lima Ferramentas',codigo:136301,produto:'DISCO DE DESBASTE 7 X 1/4 X 7/8"',grupo:'FERRAMENTAS',un:'UN',marca:'WORKER',qtd:144,valor_unit:14.00,valor_total:2016.00,validade:'',proposta:'COTACAO SERRALHERIA 03-09',id:'LIMA-03092026-05',arquivo:'Cotacao_serralheria_fornecedores db- 03-09 (2).xlsx'},
    {data:'03/09/2026',fornecedor:'Lima Ferramentas',codigo:137140,produto:'DISCO FLAP CONICO 7/8 X 7" GRAO 60',grupo:'FERRAMENTAS',un:'UN',marca:'STARRET',qtd:53,valor_unit:22.00,valor_total:1166.00,validade:'',proposta:'COTACAO SERRALHERIA 03-09',id:'LIMA-03092026-06',arquivo:'Cotacao_serralheria_fornecedores db- 03-09 (2).xlsx'},
    {data:'03/09/2026',fornecedor:'Lima Ferramentas',codigo:131549,produto:'DISCO FLAP CONICO 7/8 X 4.1/2" GRAO 80',grupo:'FERRAMENTAS',un:'UN',marca:'STARRET',qtd:27,valor_unit:8.00,valor_total:216.00,validade:'',proposta:'COTACAO SERRALHERIA 03-09',id:'LIMA-03092026-07',arquivo:'Cotacao_serralheria_fornecedores db- 03-09 (2).xlsx'},
    {data:'03/09/2026',fornecedor:'Lima Ferramentas',codigo:100483,produto:'LIMA CHATA 8"',grupo:'FERRAMENTAS',un:'PC',marca:'KEF',qtd:50,valor_unit:18.00,valor_total:900.00,validade:'',proposta:'COTACAO SERRALHERIA 03-09',id:'LIMA-03092026-08',arquivo:'Cotacao_serralheria_fornecedores db- 03-09 (2).xlsx'},
    {data:'03/09/2026',fornecedor:'Lima Ferramentas',codigo:106986,produto:'DISCO DE DESBASTE 4.1/2 X 1/4 X 7/8"',grupo:'FERRAMENTAS',un:'UN',marca:'WORKER',qtd:67,valor_unit:6.00,valor_total:402.00,validade:'',proposta:'COTACAO SERRALHERIA 03-09',id:'LIMA-03092026-09',arquivo:'Cotacao_serralheria_fornecedores db- 03-09 (2).xlsx'},
    {data:'03/09/2026',fornecedor:'Lima Ferramentas',codigo:131550,produto:"DISCO FLAP CONICO 7/8 X 7'' GRAO 80",grupo:'FERRAMENTAS',un:'UN',marca:'STARRET',qtd:11,valor_unit:22.00,valor_total:242.00,validade:'',proposta:'COTACAO SERRALHERIA 03-09',id:'LIMA-03092026-10',arquivo:'Cotacao_serralheria_fornecedores db- 03-09 (2).xlsx'},
    {data:'03/09/2026',fornecedor:'Lima Ferramentas',codigo:100761,produto:'DISCO CORTE 7" X 1/8 X 7/8',grupo:'FERRAMENTAS',un:'UN',marca:'KRONOS',qtd:57,valor_unit:10.00,valor_total:570.00,validade:'',proposta:'COTACAO SERRALHERIA 03-09',id:'LIMA-03092026-11',arquivo:'Cotacao_serralheria_fornecedores db- 03-09 (2).xlsx'},
    {data:'03/09/2026',fornecedor:'Lima Ferramentas',codigo:144799,produto:'DISCO CORTE 4.1/2 X 1/8 X7/8 2 TELA',grupo:'FERRAMENTAS',un:'UN',marca:'KRONOS',qtd:55,valor_unit:5.00,valor_total:275.00,validade:'',proposta:'COTACAO SERRALHERIA 03-09',id:'LIMA-03092026-12',arquivo:'Cotacao_serralheria_fornecedores db- 03-09 (2).xlsx'},
    {data:'03/09/2026',fornecedor:'Lima Ferramentas',codigo:115403,produto:'DISCO DE CORTE 10" X 1/8 X 5/8',grupo:'FERRAMENTAS',un:'UN',marca:'VONDER',qtd:52,valor_unit:22.00,valor_total:1144.00,validade:'',proposta:'COTACAO SERRALHERIA 03-09',id:'LIMA-03092026-13',arquivo:'Cotacao_serralheria_fornecedores db- 03-09 (2).xlsx'},
    {data:'03/09/2026',fornecedor:'Lima Ferramentas',codigo:119543,produto:'DISCO DE CORTE TURBO SECO DIAMANTE AZUL 4.1/2"',grupo:'FERRAMENTAS',un:'UN',marca:'DIAMANTE AZUL',qtd:35,valor_unit:40.00,valor_total:1400.00,validade:'',proposta:'COTACAO SERRALHERIA 03-09',id:'LIMA-03092026-14',arquivo:'Cotacao_serralheria_fornecedores db- 03-09 (2).xlsx'}
  ];
  const existing=new Set(QUOTES.map(x=>String(x.id||'')));
  for(const r of rows) if(!existing.has(r.id)) QUOTES.push(r);
  if (typeof $==='function') {
    const fs=[...new Set(QUOTES.map(x=>x.fornecedor).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'));
    const qf=$('qFornecedor'); if(qf) qf.innerHTML='<option value="">Todos</option>'+fs.map(x=>`<option>${x}</option>`).join('');
    const ps=[...new Map(QUOTES.map(x=>[`${x.codigo}|${x.produto}`,x])).values()];
    const dl=$('quoteProducts'); if(dl) dl.innerHTML=ps.map(x=>`<option value="${x.codigo||''}">${x.produto||''}</option>`).join('');
  }
  if (typeof renderQuotes==='function') renderQuotes();
})();
