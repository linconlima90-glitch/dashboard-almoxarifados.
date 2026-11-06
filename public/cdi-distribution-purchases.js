// Compras para estoque do local 30115 sao compras destinadas a distribuicao.
// Base auditada enviada em 06/11/2026; nao constitui transferencia nem economia.
(function(){
  'use strict';
  if(document.documentElement.dataset.cdiDistributionPurchases==='1'||document.documentElement.dataset.dbPilot==='1')return;
  const START='2026-05-07',LOCAL='30115';
  const groups=[
    ['FERRAMENTAS',36,5901220],
    ['CORREIAS',89,2667524],
    ['ROLAMENTOS E MANCAIS',26,1714973],
    ['FILTROS',24,1513769],
    ['OUTRAS PECAS',24,1021071],
    ['CRUZETAS CARDANS E SUAS PARTES',16,968726],
    ['PARAFUSOS PINOS PORCAS E ARRUELAS',12,502570],
    ['ANEIS DE VEDACAO JUNTAS BUCHAS E RETENTORES',7,175324],
    ['MATERIAL ELETRICO',8,171472],
    ['MATERIAL HIDRAULICO',3,152720],
    ['MOLAS AMORTECEDORES E SUAS PARTES',2,80160],
    ['FREIOS E COMPONENTES',1,80000],
    ['MATERIAL DE CONSTRUCAO',3,56100],
    ['ABRACADEIRAS',5,13838]
  ];
  const months=[
    ['2026-05',37,4001950],['2026-06',43,2931571],['2026-07',20,919487],
    ['2026-08',78,3902159],['2026-09',20,1014464],
    ['2026-10',52,1938059],['2026-11',6,311777]
  ];
  const meta={
    schemaVersion:1,classification:'COMPRA_PARA_DISTRIBUICAO',
    classificationRule:'Compra para estoque no local 30115, independentemente da empresa compradora',
    from:START,to:'2026-11-05',localCode:LOCAL,
    local:'ALMOXARIFADO GERAL F CHUA',project:'CDI DE PECAS',
    source:'COMPRAS_DE_INSUMOS_POR_LOCAL(2).xlsx',
    sourceSha256:'20d81ba16bdd3099db6e7461872581a9eed98d8504ab703e72ff855a5b20bf77',
    emission:'06/11/2026 15:24:41',lines:256,totalCents:15019467,
    distinctSkuUnits:208,groups:14,suppliers:20,
    receivingStatus:{'LANC.RECEB.':44,'NAO LANC.RECEB.':212},
    note:'Relatorio de compras para estoque TOP 89; a classificacao para distribuicao segue orientacao do responsavel em 06/11/2026. Nao comprova entrada fisica, transferencia ou economia.'
  };
  const rowDate=r=>{
    const d=String(r.data??r.date??r.Data??'').trim();
    if(/^\d{4}-\d{2}-\d{2}/.test(d))return d.slice(0,10);
    const p=d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return p?p[3]+'-'+p[2]+'-'+p[1]:'';
  };
  function qualifies(row){
    if(!row)return false;
    const local=String(row.codigo_local??row.localCode??row.CodLocal??'').trim();
    const isStock=row.compraParaEstoque===true||String(row.top??row.Top??'')==='89';
    return local===LOCAL&&isStock&&rowDate(row)>=START;
  }
  function check(){
    const sum=a=>a.reduce((t,r)=>t+r[2],0);
    const count=a=>a.reduce((t,r)=>t+r[1],0);
    if(sum(groups)!==meta.totalCents||sum(months)!==meta.totalCents||
      count(groups)!==meta.lines||count(months)!==meta.lines||
      meta.receivingStatus['LANC.RECEB.']+meta.receivingStatus['NAO LANC.RECEB.']!==meta.lines)
      throw Error('Totais das compras para distribuicao nao conciliados');
  }
  check();
  window.CDI_DISTRIBUTION_PURCHASES={
    meta,
    groups:groups.map(([name,lines,valueCents])=>({name,lines,valueCents})),
    months:months.map(([month,lines,valueCents])=>({month,lines,valueCents})),
    qualifies
  };
  const transferPanel=document.getElementById('cdi-transfer-panel');
  if(!transferPanel)return;
  document.documentElement.dataset.cdiDistributionPurchases='1';
  const fmtMoney=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const fmtInt=new Intl.NumberFormat('pt-BR');
  const money=c=>fmtMoney.format(c/100);
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const htmlRows=a=>a.map(r=>'<tr><td>'+esc(r[0])+'</td><td class="dp-num">'+fmtInt.format(r[1])+'</td><td class="dp-num"><b>'+money(r[2])+'</b></td></tr>').join('');
  const section=document.createElement('section');
  section.id='cdi-distribution-purchases';
  section.innerHTML=[
    '<div class="dp-head"><div><span class="dp-kicker">CDI de Peças · desde 07/05/2026</span>',
    '<h2>Compras para distribuição — Local 30115</h2>',
    '<p>Toda compra destinada ao estoque do local 30115 será classificada para distribuição, mesmo quando a empresa compradora for diferente da Fazenda Chua.</p></div>',
    '<span class="dp-tag">Base de compras conferida</span></div>',
    '<div class="dp-metrics"><div><small>Total comprado para distribuição</small><strong>',money(meta.totalCents),'</strong></div>',
    '<div><small>Itens de compra</small><strong>',fmtInt.format(meta.lines),'</strong></div>',
    '<div><small>Códigos e unidades distintos</small><strong>',fmtInt.format(meta.distinctSkuUnits),'</strong></div>',
    '<div><small>Grupos de produtos</small><strong>',fmtInt.format(meta.groups),'</strong></div></div>',
    '<p class="dp-warning"><b>Separação dos indicadores:</b> compra para distribuição não é transferência realizada nem economia. ',
    'Os registros de recebimento constam como ',fmtInt.format(meta.receivingStatus['LANC.RECEB.']),
    ' “LANC.RECEB.” e ',fmtInt.format(meta.receivingStatus['NAO LANC.RECEB.']),
    ' “NÃO LANC.RECEB.”; esses status não comprovam entrega física.</p>',
    '<details><summary>Conferir compras por grupo e por mês <span>›</span></summary>',
    '<div class="dp-dual"><div><h3>Por grupo (maior valor primeiro)</h3><div class="dp-table"><table><thead><tr><th>Grupo</th><th>Linhas</th><th>Total comprado</th></tr></thead><tbody>',
    htmlRows(groups),'</tbody></table></div></div>',
    '<div><h3>Por mês</h3><div class="dp-table"><table><thead><tr><th>Mês</th><th>Linhas</th><th>Total comprado</th></tr></thead><tbody>',
    htmlRows(months.map(([ym,n,v])=>[ym.slice(5)+'/'+ym.slice(0,4),n,v])),'</tbody></table></div></div></div>',
    '<p class="dp-foot">Fonte: ',esc(meta.source),' · Emitida em ',esc(meta.emission),
    ' · Compras de 07/05/2026 a 05/11/2026. Os valores por grupo e mês são resumos do arquivo; ',
    'a conferência linha a linha continuará com a planilha original quando forem enviadas as transferências.</p>',
    '</details>'
  ].join('');
  transferPanel.insertAdjacentElement('afterend',section);
  const css=document.createElement('style');
  css.id='cdi-distribution-purchases-style';
  css.textContent=[
    '#cdi-distribution-purchases{background:#fff;border:1px solid #d7e6dc;border-left:4px solid #e9b900;',
    'border-radius:13px;box-shadow:0 5px 18px rgba(13,71,38,.05);padding:14px 16px;margin:0 0 12px;color:#145b36}',
    '#cdi-distribution-purchases *{box-sizing:border-box}',
    '#cdi-distribution-purchases .dp-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}',
    '#cdi-distribution-purchases .dp-kicker{font-size:9px;font-weight:900;color:#497b58;text-transform:uppercase}',
    '#cdi-distribution-purchases h2{margin:4px 0 5px;color:#11562f;font-size:15px}',
    '#cdi-distribution-purchases p{font-size:11px;line-height:1.6;color:#60786a;margin:0}',
    '#cdi-distribution-purchases .dp-tag{white-space:nowrap;background:#eaf6ed;padding:8px 12px;',
    'border-radius:99px;font-size:10px;font-weight:850;color:#16663a}',
    '#cdi-distribution-purchases .dp-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}',
    '#cdi-distribution-purchases .dp-metrics>div{background:#f8fcf9;border:1px solid #deebe2;border-radius:9px;padding:11px 12px}',
    '#cdi-distribution-purchases .dp-metrics small{display:block;min-height:23px;text-transform:uppercase;font-size:9px;',
    'font-weight:850;color:#65786b}',
    '#cdi-distribution-purchases .dp-metrics strong{font-size:18px;color:#145e36;overflow-wrap:anywhere}',
    '#cdi-distribution-purchases .dp-warning{background:#fff9e8;border-left:3px solid #e9b900;',
    'border-radius:6px;margin:11px 0!important;padding:9px 11px;color:#68552a!important}',
    '#cdi-distribution-purchases details{border-top:1px solid #e3eee6;margin-top:8px}',
    '#cdi-distribution-purchases summary{cursor:pointer;padding-top:12px;font-size:11px;font-weight:850;',
    'color:#17643c;list-style:none}',
    '#cdi-distribution-purchases summary::-webkit-details-marker{display:none}',
    '#cdi-distribution-purchases summary span{float:right;font-size:18px}',
    '#cdi-distribution-purchases details[open] summary span{transform:rotate(90deg)}',
    '#cdi-distribution-purchases .dp-dual{display:grid;grid-template-columns:1.5fr 1fr;gap:14px;padding-top:12px}',
    '#cdi-distribution-purchases h3{font-size:12px;margin:0 0 8px;color:#145e36}',
    '#cdi-distribution-purchases .dp-table{overflow-x:auto;max-height:300px}',
    '#cdi-distribution-purchases table{width:100%;border-collapse:collapse;font-size:10px}',
    '#cdi-distribution-purchases th{position:sticky;top:0;background:#145a34!important;color:#fff!important;padding:8px;text-align:left}',
    '#cdi-distribution-purchases td{padding:8px;border-bottom:1px solid #eaf0eb;color:#375a43}',
    '#cdi-distribution-purchases .dp-num{text-align:right;white-space:nowrap}',
    '#cdi-distribution-purchases .dp-foot{margin-top:11px!important;font-size:10px!important}',
    '@media(max-width:800px){#cdi-distribution-purchases .dp-dual{grid-template-columns:1fr}',
    '#cdi-distribution-purchases .dp-head{flex-direction:column}',
    '#cdi-distribution-purchases .dp-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}'
  ].join('');
  document.head.appendChild(css);
})();