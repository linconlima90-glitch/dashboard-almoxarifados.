// Orçamento/Pedido AMEV - 26093 - 02/09/2026
(function(){
  if (typeof QUOTES === 'undefined') return;
  const rows=[
    {data:'02/09/2026',fornecedor:'AMEV',codigo:115403,produto:'DISCO DE CORTE 10" X 1/8 X 5/8',grupo:'FERRAMENTAS',un:'UN',marca:'OPER',qtd:52,valor_unit:9.24,valor_total:480.28,validade:'02/09/2026',proposta:'26093',id:'AMEV-26093-01',arquivo:'Pedido_26093 (1).pdf'},
    {data:'02/09/2026',fornecedor:'AMEV',codigo:144799,produto:'DISCO CORTE 4.1/2 X 1/8 X7/8 2 TELA',grupo:'FERRAMENTAS',un:'UN',marca:'OPER',qtd:55,valor_unit:2.48,valor_total:136.38,validade:'02/09/2026',proposta:'26093',id:'AMEV-26093-02',arquivo:'Pedido_26093 (1).pdf'},
    {data:'02/09/2026',fornecedor:'AMEV',codigo:100761,produto:'DISCO CORTE 7" X 1/8 X 7/8',grupo:'FERRAMENTAS',un:'UN',marca:'OPER',qtd:57,valor_unit:5.12,valor_total:291.79,validade:'02/09/2026',proposta:'26093',id:'AMEV-26093-03',arquivo:'Pedido_26093 (1).pdf'},
    {data:'02/09/2026',fornecedor:'AMEV',codigo:136331,produto:'DISCO CORTE 4.1/2X1.0X7/8',grupo:'FERRAMENTAS',un:'UN',marca:'TYROLIT',qtd:750,valor_unit:1.8321066667,valor_total:1374.08,validade:'02/09/2026',proposta:'26093',id:'AMEV-26093-04',arquivo:'Pedido_26093 (1).pdf'},
    {data:'02/09/2026',fornecedor:'AMEV',codigo:107243,produto:'DISCO CORTE 7 X 1.6 X 22.2MM',grupo:'FERRAMENTAS',un:'UN',marca:'TYROLIT',qtd:1000,valor_unit:6.1818,valor_total:6181.80,validade:'02/09/2026',proposta:'26093',id:'AMEV-26093-05',arquivo:'Pedido_26093 (1).pdf'},
    {data:'02/09/2026',fornecedor:'AMEV',codigo:106986,produto:'DISCO DE DESBASTE 4.1/2 X 1/4 X 7/8"',grupo:'FERRAMENTAS',un:'UN',marca:'OPER',qtd:67,valor_unit:4.2562686567,valor_total:285.17,validade:'02/09/2026',proposta:'26093',id:'AMEV-26093-06',arquivo:'Pedido_26093 (1).pdf'},
    {data:'02/09/2026',fornecedor:'AMEV',codigo:136301,produto:'DISCO DE DESBASTE 7 X 1/4 X 7/8"',grupo:'FERRAMENTAS',un:'UN',marca:'OPER',qtd:144,valor_unit:8.6629861111,valor_total:1247.47,validade:'02/09/2026',proposta:'26093',id:'AMEV-26093-07',arquivo:'Pedido_26093 (1).pdf'},
    {data:'02/09/2026',fornecedor:'AMEV',codigo:136300,produto:'DISCO FLAP CONICO 7/8 X 4.1/2" GRAO 40',grupo:'FERRAMENTAS',un:'UN',marca:'OPER',qtd:235,valor_unit:4.2334042553,valor_total:994.85,validade:'02/09/2026',proposta:'26093',id:'AMEV-26093-08',arquivo:'Pedido_26093 (1).pdf'},
    {data:'02/09/2026',fornecedor:'AMEV',codigo:131549,produto:'DISCO FLAP CONICO 7/8 X 4.1/2" GRAO 80',grupo:'FERRAMENTAS',un:'UN',marca:'OPER',qtd:27,valor_unit:4.0803703704,valor_total:110.17,validade:'02/09/2026',proposta:'26093',id:'AMEV-26093-09',arquivo:'Pedido_26093 (1).pdf'},
    {data:'02/09/2026',fornecedor:'AMEV',codigo:137140,produto:'DISCO FLAP CONICO 7/8 X 7" GRAO 60',grupo:'FERRAMENTAS',un:'UN',marca:'OPER',qtd:53,valor_unit:12.3124528302,valor_total:652.56,validade:'02/09/2026',proposta:'26093',id:'AMEV-26093-10',arquivo:'Pedido_26093 (1).pdf'},
    {data:'02/09/2026',fornecedor:'AMEV',codigo:131550,produto:"DISCO FLAP CONICO 7/8 X 7'' GRAO 80",grupo:'FERRAMENTAS',un:'UN',marca:'OPER',qtd:11,valor_unit:12.0809090909,valor_total:132.89,validade:'02/09/2026',proposta:'26093',id:'AMEV-26093-11',arquivo:'Pedido_26093 (1).pdf'}
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
