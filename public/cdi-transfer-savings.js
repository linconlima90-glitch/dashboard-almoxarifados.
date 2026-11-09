// Resultado das transferencias CDI: independente de compras, estoques e baixas.
(function(){
  'use strict';
  if(document.documentElement.dataset.cdiTransfersPanel==='1' || document.documentElement.dataset.dbPilot==='1')return;
  var measure=document.getElementById('kEconomiaPct') || document.getElementById('kDif');
  var view=measure && measure.closest('.view');
  var cards=view && view.querySelector('.cards');
  if(!cards)return;
  document.documentElement.dataset.cdiTransfersPanel='1';
  var START='2026-05-07',money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}),
    integer=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}),
    quantity=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:4});
  var esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
  var norm=function(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim()};
  var cents=function(q,p){return Math.round((q*p+Number.EPSILON)*100)};
  var currency=function(c){return c==null?'—':money.format(c/100)};
  var isNum=function(v){return typeof v==='number'&&Number.isFinite(v)};
  var optionalMoney=function(v,field){if(v==null)return null;if(!isNum(v)||v<0)throw Error('Custo invalido: '+field);return v};
  function validate(source){
    if(!source||source.schemaVersion!==1||source.approvalDate!==START||!Array.isArray(source.transfers))
      throw Error('Base de transferencias CDI ou marco de 07/05/2026 invalido.');
    var ids=new Set(),out=[];
    for(var r of source.transfers){
      if(!r||!r.id||ids.has(String(r.id)))throw Error('Transferencia sem ID ou ID duplicado.');
      ids.add(String(r.id));
      if(typeof r.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||
        !Number.isFinite(Date.parse(r.date+'T12:00:00Z'))||new Date(r.date+'T12:00:00Z').toISOString().slice(0,10)!==r.date||
        r.date<START)throw Error('Data anterior ao projeto CDI ou data invalida: '+r.id);
      for(var f of ['document','origin','destination','code','product','group','unit']){
        if(!String(r[f]||'').trim())throw Error('Campo ausente '+f+' na transferencia '+r.id);
      }
      if(!isNum(r.quantity)||r.quantity<=0)throw Error('Quantidade invalida na transferencia '+r.id);
      var cdiUnitCost=optionalMoney(r.cdiUnitCost,'cdiUnitCost'),
        alternativePurchasePrice=optionalMoney(r.alternativePurchasePrice,'alternativePurchasePrice'),
        transferCost=optionalMoney(r.transferCost,'transferCost');
      var status=r.reviewStatus||'PENDENTE';
      if(status!=='PENDENTE'&&status!=='VALIDADO')throw Error('Situacao invalida na transferencia '+r.id);
      var comparable=cdiUnitCost!==null&&alternativePurchasePrice!==null&&transferCost!==null;
      if(status==='VALIDADO'&&(!comparable||!String(r.evidence||'').trim()))
        throw Error('Economia validada sem comparativo completo e comprovacao: '+r.id);
      var moved=cdiUnitCost===null?null:cents(r.quantity,cdiUnitCost),
        alternative=alternativePurchasePrice===null?null:cents(r.quantity,alternativePurchasePrice),
        diff=comparable?alternative-moved-cents(1,transferCost):null;
      out.push(Object.assign({},r,{
        reviewStatus:status,cdiUnitCost:cdiUnitCost,alternativePurchasePrice:alternativePurchasePrice,
        transferCost:transferCost,movedCents:moved,alternativeCents:alternative,comparisonCents:diff,
        validatedCents:status==='VALIDADO'?diff:null
      }));
    }
    return out;
  }
  var state={year:'',destination:'',group:'',product:'',query:''},data=[],error='';
  var section=document.createElement('section');
  section.id='cdi-transfer-panel';
  section.setAttribute('aria-label','Economia com transferencias do CDI');
  section.innerHTML=[
    '<div class="cdtr-heading"><div><span class="cdtr-eyebrow">Projeto CDI de Peças • aprovado em 07/05/2026</span>',
    '<h2>Distribuição de materiais pelo CDI de Peças</h2>',
    '<p>Materiais redistribuídos da Chuá para outras unidades desde 07/05/2026. Valor transferido é movimentação interna; a economia comprovada é apurada separadamente.</p></div>',
    '<span class="cdtr-state" id="cdtr-state">Aguardando planilha</span></div>',
    '<div class="cdtr-metrics"><div><small>Transferências conciliadas</small><strong id="cdtr-count">Aguardando planilha</strong></div>',
    '<div><small>Valor distribuído · custo ERP</small><strong id="cdtr-value">—</strong></div>',
    '<div><small>Preço de compra alternativo</small><strong id="cdtr-reference">—</strong></div>',
    '<div><small>Economia comprovada por preços</small><strong id="cdtr-confirmed">—</strong></div></div>',
    '<p class="cdtr-foot" id="cdtr-foot">Aguardando histórico de transferências. Os valores atuais de estoque e compras não são alterados.</p>',
    '<details id="cdtr-details"><summary>Consultar transferências, filtros e critério de cálculo <span>›</span></summary>',
    '<div class="cdtr-detail"><div class="cdtr-method"><b>Critério:</b> economia comparativa = quantidade × (preço de compra alternativo − custo unitário CDI) − custo adicional da transferência. ',
    'Só é validada quando o comparativo e a compra evitada estão documentados. O valor transferido é movimentação interna, não economia realizada. ',
    'Diferenças negativas permanecem negativas e não são omitidas. A partir de 07/05/2026 (inclusive).</div>',
    '<div class="cdtr-filters">',
    '<label>Ano<select id="cdtr-year"><option value="">Todos desde 07/05/2026</option></select></label>',
    '<label>Unidade de destino<select id="cdtr-destination"><option value="">Todas as unidades</option></select></label>',
    '<label>Grupo<select id="cdtr-group"><option value="">Todos os grupos</option></select></label>',
    '<label>Produto<select id="cdtr-product"><option value="">Todos os produtos</option></select></label>',
    '<label>Buscar documento / código<input id="cdtr-search" type="search" placeholder="Pesquisar..."></label>',
    '<button type="button" id="cdtr-export" disabled>Exportar CSV</button></div>',
    '<p class="cdtr-filter-state" id="cdtr-filter-state"></p>',
    '<div class="cdtr-table"><table><thead><tr><th>Data</th><th>Documento</th><th>Origem CDI</th><th>Destino</th>',
    '<th>Grupo</th><th>Código / produto</th><th>Qtd. / UN</th><th>Valor transferido</th><th>Preço alternativo</th>',
    '<th>Logística</th><th>Diferença comparativa</th><th>Situação</th></tr></thead><tbody id="cdtr-body"></tbody></table></div>',
    '</div></details>'
  ].join('');
  cards.insertAdjacentElement('afterend',section);
  var style=document.createElement('style');style.id='cdi-transfer-styles';
  style.textContent=[
    '#cdi-transfer-panel{background:#fff;border:1px solid #d5e5da;border-left:4px solid #16733b;',
      'box-shadow:0 5px 18px rgba(13,71,38,.05);border-radius:13px;margin:0 0 12px;padding:14px 16px;color:#1a4930}',
    '#cdi-transfer-panel *{box-sizing:border-box}',
    '#cdi-transfer-panel .cdtr-heading{display:flex;justify-content:space-between;align-items:start;gap:16px;margin-bottom:12px}',
    '#cdi-transfer-panel h2{font-size:15px;font-weight:900;color:#115830;margin:3px 0 5px}',
    '#cdi-transfer-panel p{font-size:11px;line-height:1.5;margin:0;color:#687b6d}',
    '#cdi-transfer-panel .cdtr-eyebrow{color:#17693c;text-transform:uppercase;font-size:9px;font-weight:900;letter-spacing:.04em}',
    '#cdi-transfer-panel .cdtr-state{font-size:11px;white-space:nowrap;font-weight:850;border-radius:99px;padding:7px 11px;background:#fff7dd;color:#7b590e}',
    '#cdi-transfer-panel .cdtr-state.cdtr-ready{background:#e4f5e9;color:#166339}',
    '#cdi-transfer-panel .cdtr-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}',
    '#cdi-transfer-panel .cdtr-metrics>div{padding:11px 12px;border:1px solid #e0ebe3;border-radius:9px;background:#f9fcfa;min-width:0}',
    '#cdi-transfer-panel .cdtr-metrics small{display:block;min-height:23px;color:#677d6c;font-size:9px;text-transform:uppercase;font-weight:850}',
    '#cdi-transfer-panel .cdtr-metrics strong{display:block;color:#0d5830;font-size:17px;overflow-wrap:anywhere}',
    '#cdi-transfer-panel .cdtr-metrics>div:last-child{border-left:3px solid #efc43c}',
    '#cdi-transfer-panel .cdtr-foot{margin:10px 0 0!important;font-size:10px!important}',
    '#cdi-transfer-panel details{margin-top:11px;border-top:1px solid #e0ece4}',
    '#cdi-transfer-panel details>summary{padding:11px 0 1px;cursor:pointer;color:#17613a;font-size:11px;font-weight:850;list-style:none}',
    '#cdi-transfer-panel details>summary::-webkit-details-marker{display:none}',
    '#cdi-transfer-panel details>summary span{float:right;font-size:16px}',
    '#cdi-transfer-panel details[open]>summary span{transform:rotate(90deg)}',
    '#cdi-transfer-panel .cdtr-detail{padding-top:11px}',
    '#cdi-transfer-panel .cdtr-method{padding:10px 12px;border-left:3px solid #d5a624;background:#fffbef;border-radius:7px;font-size:11px;line-height:1.6;color:#675620}',
    '#cdi-transfer-panel .cdtr-filters{display:grid;grid-template-columns:1.1fr 1.45fr 1fr 1.5fr 1.4fr auto;gap:8px;align-items:end;margin:13px 0}',
    '#cdi-transfer-panel .cdtr-filters label{font-size:10px;font-weight:800;color:#607567;min-width:0}',
    '#cdi-transfer-panel .cdtr-filters select,#cdi-transfer-panel .cdtr-filters input{display:block;width:100%;height:36px;margin-top:4px;',
      'padding:7px;border:1px solid #d3e3d7;border-radius:8px;background:#fff;font-size:11px;color:#244f35}',
    '#cdi-transfer-panel .cdtr-filters select:disabled{background:#f1f4f2;color:#9bab9e}',
    '#cdi-transfer-panel #cdtr-export{height:36px;white-space:nowrap;padding:0 12px;background:#e9f7ed;color:#176039;',
      'font-size:11px;font-weight:800;border:1px solid #bddac5;border-radius:8px;cursor:pointer}',
    '#cdi-transfer-panel #cdtr-export:disabled{opacity:.45;cursor:default}',
    '#cdi-transfer-panel .cdtr-filter-state{padding:3px 0 9px!important;color:#33724c!important;font-weight:800}',
    '#cdi-transfer-panel .cdtr-table{max-height:400px;overflow:auto;border:1px solid #deebe2;border-radius:8px}',
    '#cdi-transfer-panel table{width:100%;min-width:1180px;border-collapse:collapse;font-size:10px}',
    '#cdi-transfer-panel th{position:sticky;top:0;padding:9px 7px;text-align:left;background:#145c36!important;color:white!important;white-space:nowrap}',
    '#cdi-transfer-panel td{padding:8px;border-bottom:1px solid #eaf1ec;vertical-align:top}',
    '#cdi-transfer-panel .cdtr-positive{color:#147442;font-weight:800}',
    '#cdi-transfer-panel .cdtr-negative{color:#a23d34;font-weight:800}',
    '@media(max-width:1100px){#cdi-transfer-panel .cdtr-filters{grid-template-columns:repeat(3,minmax(0,1fr))}}',
    '@media(max-width:700px){#cdi-transfer-panel .cdtr-heading{flex-direction:column;gap:8px}',
      '#cdi-transfer-panel .cdtr-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}',
      '#cdi-transfer-panel .cdtr-filters{grid-template-columns:1fr 1fr}}',
    '@media(max-width:450px){#cdi-transfer-panel .cdtr-filters{grid-template-columns:1fr}}'
  ].join('');
  document.head.appendChild(style);
  var $=function(q){return section.querySelector(q)};
  function fill(id,list,placeholder){
    var select=$(id),keep=select.value,opts=['<option value="">'+esc(placeholder)+'</option>'];
    list.forEach(function(value){opts.push('<option value="'+esc(value)+'">'+esc(value)+'</option>')});
    select.innerHTML=opts.join('');
    select.value=list.includes(keep)?keep:'';
    return select.value;
  }
  function sum(rows,key){var values=rows.map(function(r){return r[key]}).filter(function(v){return v!=null});return values.length?values.reduce(function(a,b){return a+b},0):null}
  function sortPt(a,b){return a.localeCompare(b,'pt-BR')}
  function display(){
    try{data=validate(window.CDI_TRANSFER_LEDGER);error=''}catch(e){data=[];error=e.message}
    var all=data,years=[...new Set(all.map(function(r){return r.date.slice(0,4)}))].sort();
    if(!years.includes('2026'))years.unshift('2026');
    state.year=fill('#cdtr-year',years,'Todos desde 07/05/2026');
    var yearRows=all.filter(function(r){return !state.year||r.date.startsWith(state.year)});
    var destinations=[...new Set(yearRows.map(function(r){return r.destination}))].sort(sortPt);
    state.destination=fill('#cdtr-destination',destinations,'Todas as unidades');
    var byDest=yearRows.filter(function(r){return !state.destination||r.destination===state.destination});
    var groups=[...new Set(byDest.map(function(r){return r.group}))].sort(sortPt);
    state.group=fill('#cdtr-group',groups,'Todos os grupos');
    var byGroup=byDest.filter(function(r){return !state.group||r.group===state.group});
    var productList=[...new Set(byGroup.map(function(r){return r.code+' | '+r.product}))].sort(sortPt);
    state.product=fill('#cdtr-product',productList,'Todos os produtos');
    var rows=byGroup.filter(function(r){return (!state.product||r.code+' | '+r.product===state.product)&&
      (!state.query||norm([r.document,r.code,r.product,r.group,r.origin,r.destination].join(' ')).includes(norm(state.query)))});
    rows.sort(function(a,b){return b.date.localeCompare(a.date)||a.destination.localeCompare(b.destination,'pt-BR')});
    $('#cdtr-destination').disabled=!yearRows.length;
    $('#cdtr-group').disabled=!byDest.length;
    $('#cdtr-product').disabled=!byGroup.length;
    $('#cdtr-export').disabled=!rows.length;
    var approved=rows.filter(function(r){return r.reviewStatus==='VALIDADO'});
    $('#cdtr-count').textContent=all.length?integer.format(rows.length):'Aguardando planilha';
    $('#cdtr-value').textContent=currency(sum(rows,'movedCents'));
    $('#cdtr-reference').textContent=currency(sum(rows,'alternativeCents'));
    $('#cdtr-confirmed').textContent=currency(sum(approved,'validatedCents'));
    var stateLabel=$('#cdtr-state');
    stateLabel.textContent=error?'Revisar dados':all.length?'Histórico registrado':'Aguardando planilha';
    stateLabel.classList.toggle('cdtr-ready',!!all.length&&!error);
    $('#cdtr-foot').textContent=error?'Importação não validada: '+error:
      !all.length?'Envie a planilha de transferências do CDI. Nenhuma economia é contabilizada até a conferência dos dados.':
      integer.format(rows.length)+' linhas exibidas; '+integer.format(approved.length)+' validações econômicas documentadas. Sem alteração de saldos ERP nem duplicação com a economia de compras.';
    $('#cdtr-filter-state').textContent=error?'Erro de validação':
      !all.length?'Nenhuma transferência importada ainda.':integer.format(rows.length)+' linhas nos filtros; '+integer.format(rows.filter(function(r){return r.comparisonCents!=null}).length)+' com comparativo completo.';
    $('#cdtr-body').innerHTML=!rows.length?'<tr><td colspan="12" style="padding:20px;text-align:center;color:#6f8273">Aguardando transferências elegíveis desde 07/05/2026.</td></tr>':
      rows.map(function(r){
        return '<tr><td>'+esc(r.date.slice(8)+'/'+r.date.slice(5,7)+'/'+r.date.slice(0,4))+'</td>'+
          '<td>'+esc(r.document)+'</td><td>'+esc(r.origin)+'</td><td>'+esc(r.destination)+'</td>'+
          '<td>'+esc(r.group)+'</td><td><b>'+esc(r.code)+'</b> · '+esc(r.product)+'</td>'+
          '<td>'+quantity.format(r.quantity)+' '+esc(r.unit)+'</td>'+
          '<td>'+currency(r.movedCents)+'</td><td>'+currency(r.alternativeCents)+'</td>'+
          '<td>'+(r.transferCost==null?'—':money.format(r.transferCost))+'</td>'+
          '<td class="'+(r.comparisonCents<0?'cdtr-negative':'cdtr-positive')+'">'+currency(r.comparisonCents)+'</td>'+
          '<td>'+esc(r.reviewStatus==='VALIDADO'?'Validado':'Pendente')+'</td></tr>'
      }).join('');
    return {approvalDate:START,rows:all.length,shown:rows.length,validated:all.filter(function(r){return r.reviewStatus==='VALIDADO'}).length,
      status:error?'ERRO':all.length?'REGISTRADO':'AGUARDANDO_PLANILHA',
      movedCents:sum(all,'movedCents'),alternativeCents:sum(all,'alternativeCents'),
      validatedCents:sum(all.filter(function(r){return r.reviewStatus==='VALIDADO'}),'validatedCents'),
      error:error};
  }
  $('#cdtr-year').addEventListener('change',function(e){state.year=e.target.value;state.destination='';state.group='';state.product='';display()});
  $('#cdtr-destination').addEventListener('change',function(e){state.destination=e.target.value;state.group='';state.product='';display()});
  $('#cdtr-group').addEventListener('change',function(e){state.group=e.target.value;state.product='';display()});
  $('#cdtr-product').addEventListener('change',function(e){state.product=e.target.value;display()});
  $('#cdtr-search').addEventListener('input',function(e){state.query=e.target.value;display()});
  $('#cdtr-export').addEventListener('click',function(){
    if(!data.length)return;
    var selected=data.filter(function(r){return (!state.year||r.date.startsWith(state.year))&&
      (!state.destination||r.destination===state.destination)&&(!state.group||r.group===state.group)&&
      (!state.product||r.code+' | '+r.product===state.product)&&
      (!state.query||norm([r.document,r.code,r.product,r.group,r.origin,r.destination].join(' ')).includes(norm(state.query)))});
    if(!selected.length)return;
    var lines=[['Data','Documento transferencia','Origem CDI','Destino','Grupo','Codigo','Produto','UN','Quantidade',
      'Custo unitario CDI','Preco compra alternativa','Custo logistica','Valor transferido','Valor compra alternativa',
      'Diferenca comparativa','Status validacao','Evidencia']];
    for(var r of selected)lines.push([r.date,r.document,r.origin,r.destination,r.group,r.code,r.product,r.unit,
      r.quantity,r.cdiUnitCost??'',r.alternativePurchasePrice??'',r.transferCost??'',
      r.movedCents==null?'':r.movedCents/100,r.alternativeCents==null?'':r.alternativeCents/100,
      r.comparisonCents==null?'':r.comparisonCents/100,r.reviewStatus,r.evidence||'']);
    var safe=function(v){var s=String(v==null?'':v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
    var file='\ufeff'+lines.map(function(row){return row.map(safe).join(';')}).join('\r\n');
    var url=URL.createObjectURL(new Blob([file],{type:'text/csv;charset=utf-8'}));
    var a=document.createElement('a');a.href=url;a.download='economia_transferencias_CDI_desde_2026-05-07.csv';a.click();
    setTimeout(function(){URL.revokeObjectURL(url)},1000);
  });
  window.CDI_TRANSFER_CONTROL={
    validate:validate,summary:display,refresh:display,
    getRows:function(){return data.slice()},
    approvalDate:START
  };
  display();
})();
