// Orçamento NEW-FIX - Cotação 45978601 - 02/09/2026
(function(){
  if (typeof QUOTES === 'undefined') return;
  const rows=[
    {data:'02/09/2026',fornecedor:'NEW-FIX INDUSTRIA E COMERCIO LTDA',codigo:107243,produto:'DISCO CORTE 7 X 1.6 X 22.2MM',grupo:'FERRAMENTAS',un:'UN',marca:'DISCO-FIX',qtd:1000,valor_unit:2.78,valor_total:2780.00,validade:'09/09/2026',proposta:'45978601',id:'NEWFIX-45978601-01',arquivo:'DB (5).PDF'},
    {data:'02/09/2026',fornecedor:'NEW-FIX INDUSTRIA E COMERCIO LTDA',codigo:136331,produto:'DISCO CORTE 4.1/2X1.0X7/8',grupo:'FERRAMENTAS',un:'UN',marca:'DISCO-FIX',qtd:750,valor_unit:1.00,valor_total:750.00,validade:'09/09/2026',proposta:'45978601',id:'NEWFIX-45978601-02',arquivo:'DB (5).PDF'},
    {data:'02/09/2026',fornecedor:'NEW-FIX INDUSTRIA E COMERCIO LTDA',codigo:136300,produto:'DISCO FLAP CONICO 7/8 X 4.1/2" GRAO 40',grupo:'FERRAMENTAS',un:'UN',marca:'DISCO-FIX',qtd:240,valor_unit:3.36,valor_total:806.40,validade:'09/09/2026',proposta:'45978601',id:'NEWFIX-45978601-03',arquivo:'DB (5).PDF'},
    {data:'02/09/2026',fornecedor:'NEW-FIX INDUSTRIA E COMERCIO LTDA',codigo:108189,produto:'DISCO CORTE 4.1/2 X 1/8 X7/8',grupo:'FERRAMENTAS',un:'UN',marca:'DISCO-FIX',qtd:50,valor_unit:1.78,valor_total:89.00,validade:'09/09/2026',proposta:'45978601',id:'NEWFIX-45978601-04',arquivo:'DB (5).PDF'},
    {data:'02/09/2026',fornecedor:'NEW-FIX INDUSTRIA E COMERCIO LTDA',codigo:136301,produto:'DISCO DE DESBASTE 7 X 1/4 X 7/8"',grupo:'FERRAMENTAS',un:'UN',marca:'DISCO-FIX',qtd:150,valor_unit:6.18,valor_total:927.00,validade:'09/09/2026',proposta:'45978601',id:'NEWFIX-45978601-05',arquivo:'DB (5).PDF'},
    {data:'02/09/2026',fornecedor:'NEW-FIX INDUSTRIA E COMERCIO LTDA',codigo:137140,produto:'DISCO FLAP CONICO 7/8 X 7" GRAO 60',grupo:'FERRAMENTAS',un:'UN',marca:'DISCO-FIX',qtd:60,valor_unit:8.13,valor_total:487.80,validade:'09/09/2026',proposta:'45978601',id:'NEWFIX-45978601-06',arquivo:'DB (5).PDF'},
    {data:'02/09/2026',fornecedor:'NEW-FIX INDUSTRIA E COMERCIO LTDA',codigo:131549,produto:'DISCO FLAP CONICO 7/8 X 4.1/2" GRAO 80',grupo:'FERRAMENTAS',un:'UN',marca:'DISCO-FIX',qtd:30,valor_unit:3.36,valor_total:100.80,validade:'09/09/2026',proposta:'45978601',id:'NEWFIX-45978601-07',arquivo:'DB (5).PDF'},
    {data:'02/09/2026',fornecedor:'NEW-FIX INDUSTRIA E COMERCIO LTDA',codigo:131550,produto:"DISCO FLAP CONICO 7/8 X 7'' GRAO 80",grupo:'FERRAMENTAS',un:'UN',marca:'DISCO-FIX',qtd:15,valor_unit:8.13,valor_total:121.95,validade:'09/09/2026',proposta:'45978601',id:'NEWFIX-45978601-08',arquivo:'DB (5).PDF'},
    {data:'02/09/2026',fornecedor:'NEW-FIX INDUSTRIA E COMERCIO LTDA',codigo:100761,produto:'DISCO CORTE 7" X 1/8 X 7/8',grupo:'FERRAMENTAS',un:'UN',marca:'DISCO-FIX',qtd:50,valor_unit:3.54,valor_total:177.00,validade:'09/09/2026',proposta:'45978601',id:'NEWFIX-45978601-09',arquivo:'DB (5).PDF'}
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
