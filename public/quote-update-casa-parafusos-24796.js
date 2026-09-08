// Orçamento Casa dos Parafusos - 24796 - 03/09/2026
(function(){
  if (typeof QUOTES === 'undefined') return;
  const rows=[
    {data:'03/09/2026',fornecedor:'Casa dos Parafusos',codigo:107243,produto:'DISCO CORTE 7 X 1.6 X 22.2MM',grupo:'FERRAMENTAS',un:'UN',marca:'STARRETT',qtd:997,valor_unit:6.16,valor_total:6141.52,validade:'03/09/2026',proposta:'24796',id:'CASAPARAFUSOS-24796-01',arquivo:'24796 (1).pdf'},
    {data:'03/09/2026',fornecedor:'Casa dos Parafusos',codigo:136331,produto:'DISCO CORTE 4.1/2X1.0X7/8',grupo:'FERRAMENTAS',un:'UN',marca:'STARRETT',qtd:740,valor_unit:2.72,valor_total:2012.80,validade:'03/09/2026',proposta:'24796',id:'CASAPARAFUSOS-24796-02',arquivo:'24796 (1).pdf'},
    {data:'03/09/2026',fornecedor:'Casa dos Parafusos',codigo:136300,produto:'DISCO FLAP CONICO 7/8 X 4.1/2" GRAO 40',grupo:'FERRAMENTAS',un:'UN',marca:'TANKER',qtd:235,valor_unit:6.00,valor_total:1410.00,validade:'03/09/2026',proposta:'24796',id:'CASAPARAFUSOS-24796-03',arquivo:'24796 (1).pdf'},
    {data:'03/09/2026',fornecedor:'Casa dos Parafusos',codigo:108189,produto:'DISCO CORTE 4.1/2 X 1/8 X7/8',grupo:'FERRAMENTAS',un:'UN',marca:'STARRETT',qtd:48,valor_unit:2.72,valor_total:130.56,validade:'03/09/2026',proposta:'24796',id:'CASAPARAFUSOS-24796-04',arquivo:'24796 (1).pdf'},
    {data:'03/09/2026',fornecedor:'Casa dos Parafusos',codigo:136301,produto:'DISCO DE DESBASTE 7 X 1/4 X 7/8"',grupo:'FERRAMENTAS',un:'UN',marca:'KRONOS',qtd:144,valor_unit:16.40,valor_total:2361.60,validade:'03/09/2026',proposta:'24796',id:'CASAPARAFUSOS-24796-05',arquivo:'24796 (1).pdf'},
    {data:'03/09/2026',fornecedor:'Casa dos Parafusos',codigo:137140,produto:'DISCO FLAP CONICO 7/8 X 7" GRAO 60',grupo:'FERRAMENTAS',un:'UN',marca:'STARRETT',qtd:53,valor_unit:21.60,valor_total:1144.80,validade:'03/09/2026',proposta:'24796',id:'CASAPARAFUSOS-24796-06',arquivo:'24796 (1).pdf'},
    {data:'03/09/2026',fornecedor:'Casa dos Parafusos',codigo:131549,produto:'DISCO FLAP CONICO 7/8 X 4.1/2" GRAO 80',grupo:'FERRAMENTAS',un:'UN',marca:'TANKER',qtd:27,valor_unit:6.32,valor_total:170.64,validade:'03/09/2026',proposta:'24796',id:'CASAPARAFUSOS-24796-07',arquivo:'24796 (1).pdf'},
    {data:'03/09/2026',fornecedor:'Casa dos Parafusos',codigo:100483,produto:'LIMA CHATA 8"',grupo:'FERRAMENTAS',un:'PC',marca:'KF',qtd:50,valor_unit:15.60,valor_total:780.00,validade:'03/09/2026',proposta:'24796',id:'CASAPARAFUSOS-24796-08',arquivo:'24796 (1).pdf'},
    {data:'03/09/2026',fornecedor:'Casa dos Parafusos',codigo:106986,produto:'DISCO DE DESBASTE 4.1/2 X 1/4 X 7/8"',grupo:'FERRAMENTAS',un:'UN',marca:'KRONOS',qtd:67,valor_unit:8.80,valor_total:589.60,validade:'03/09/2026',proposta:'24796',id:'CASAPARAFUSOS-24796-09',arquivo:'24796 (1).pdf'},
    {data:'03/09/2026',fornecedor:'Casa dos Parafusos',codigo:131550,produto:"DISCO FLAP CONICO 7/8 X 7'' GRAO 80",grupo:'FERRAMENTAS',un:'UN',marca:'STARRETT',qtd:11,valor_unit:21.60,valor_total:237.60,validade:'03/09/2026',proposta:'24796',id:'CASAPARAFUSOS-24796-10',arquivo:'24796 (1).pdf'},
    {data:'03/09/2026',fornecedor:'Casa dos Parafusos',codigo:100761,produto:'DISCO CORTE 7" X 1/8 X 7/8',grupo:'FERRAMENTAS',un:'UN',marca:'KRONOS',qtd:57,valor_unit:8.56,valor_total:487.92,validade:'03/09/2026',proposta:'24796',id:'CASAPARAFUSOS-24796-11',arquivo:'24796 (1).pdf'},
    {data:'03/09/2026',fornecedor:'Casa dos Parafusos',codigo:144799,produto:'DISCO CORTE 4.1/2 X 1/8 X7/8 2 TELA',grupo:'FERRAMENTAS',un:'UN',marca:'KRONOS',qtd:55,valor_unit:5.84,valor_total:321.20,validade:'03/09/2026',proposta:'24796',id:'CASAPARAFUSOS-24796-12',arquivo:'24796 (1).pdf'},
    {data:'03/09/2026',fornecedor:'Casa dos Parafusos',codigo:115403,produto:'DISCO DE CORTE 10" X 1/8 X 5/8',grupo:'FERRAMENTAS',un:'UN',marca:'KRONOS',qtd:52,valor_unit:14.32,valor_total:744.64,validade:'03/09/2026',proposta:'24796',id:'CASAPARAFUSOS-24796-13',arquivo:'24796 (1).pdf'},
    {data:'03/09/2026',fornecedor:'Casa dos Parafusos',codigo:119543,produto:'DISCO DE CORTE TURBO SECO DIAMANTE AZUL 4.1/2"',grupo:'FERRAMENTAS',un:'UN',marca:'DIAMANTE AZUL',qtd:35,valor_unit:34.40,valor_total:1204.00,validade:'03/09/2026',proposta:'24796',id:'CASAPARAFUSOS-24796-14',arquivo:'24796 (1).pdf'}
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
