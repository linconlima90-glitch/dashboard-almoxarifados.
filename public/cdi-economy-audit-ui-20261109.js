// Auditoria gerencial, mantida separada do valor transferido e dos indicadores de compras.
(function(){
'use strict';
if(document.documentElement.dataset.dbPilot==='1')return;
const A=window.DB_ECONOMY_AUDIT, host=document.getElementById('reallocation-reuse-panel');
if(!host||document.getElementById('cdi-economy-audit-panel'))return;
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const fmt=v=>money.format((Number(v)||0)/100);
const qty=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:4});
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const section=document.createElement('section');
section.id='cdi-economy-audit-panel';
section.setAttribute('aria-labelledby','cea-title');
section.style.cssText='background:white;border:1px solid #cfe2d5;border-radius:14px;padding:22px 25px;margin:16px 0;color:#1d4b32;font-family:inherit';
const style=document.createElement('style');
style.id='cdi-economy-audit-css';
style.textContent=[
'#cdi-economy-audit-panel *{box-sizing:border-box}',
'#cdi-economy-audit-panel .cea-eyebrow{font-size:10px;color:#477d57;font-weight:850;letter-spacing:.07em;margin:0 0 6px}',
'#cdi-economy-audit-panel h2{font-size:21px;margin:0 0 7px;letter-spacing:-.02em;color:#17482d}',
'#cdi-economy-audit-panel p{font-size:11px;line-height:1.6;color:#5e7465;margin:0}',
'#cdi-economy-audit-panel .cea-warning{background:#fffcf2;border-left:3px solid #bd9732;padding:12px 13px;margin:15px 0;color:#715b2c;font-size:11px;line-height:1.6}',
'#cdi-economy-audit-panel .cea-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:17px 0}',
'#cdi-economy-audit-panel .cea-stat{padding:15px;border:1px solid #d9e8dc;border-radius:10px;background:#f8fbf9;min-width:0}',
'#cdi-economy-audit-panel .cea-stat small{font-size:10px;color:#647c6b;display:block;min-height:28px}',
'#cdi-economy-audit-panel .cea-stat strong{font-size:21px;color:#145d36;display:block;margin:4px 0;font-variant-numeric:tabular-nums}',
'#cdi-economy-audit-panel .cea-stat span{font-size:10px;color:#748776}',
'#cdi-economy-audit-panel .cea-columns{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0}',
'#cdi-economy-audit-panel .cea-card{border:1px solid #dce7de;border-radius:11px;padding:17px}',
'#cdi-economy-audit-panel .cea-card h3{font-size:14px;margin:0 0 11px;color:#23583d}',
'#cdi-economy-audit-panel .cea-pair{display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:1px solid #e9eee9;padding:9px 0;font-size:11px}',
'#cdi-economy-audit-panel .cea-pair span{color:#647568}',
'#cdi-economy-audit-panel .cea-pair strong{font-variant-numeric:tabular-nums;white-space:nowrap}',
'#cdi-economy-audit-panel .cea-card .cea-note{font-size:10px;color:#76877b;line-height:1.6;margin-top:8px}',
'#cdi-economy-audit-panel details{border:1px solid #dce7de;border-radius:10px;margin-top:12px;overflow:hidden}',
'#cdi-economy-audit-panel details>summary{padding:15px 17px;background:#f3f8f4;font-size:12px;font-weight:850;cursor:pointer;list-style:none}',
'#cdi-economy-audit-panel details>summary::-webkit-details-marker{display:none}',
'#cdi-economy-audit-panel .cea-detail{padding:15px}',
'#cdi-economy-audit-panel .cea-filters{display:grid;grid-template-columns:1fr 1fr 1fr 1.4fr auto;gap:9px;align-items:end}',
'#cdi-economy-audit-panel .cea-filters label{font-size:10px;color:#526e5a;font-weight:800}',
'#cdi-economy-audit-panel select,#cdi-economy-audit-panel input{display:block;width:100%;border:1px solid #cadaD0;border-radius:7px;background:#fff;height:36px;margin-top:5px;padding:7px 8px;font-size:11px}',
'#cdi-economy-audit-panel button{border:1px solid #b9d4c1;border-radius:7px;background:#e8f5ec;color:#1c693d;font-size:11px;font-weight:800;padding:9px 12px;cursor:pointer;min-height:36px}',
'#cdi-economy-audit-panel .cea-rollup{display:flex;justify-content:space-between;gap:15px;align-items:center;background:#f6faf7;border-radius:8px;padding:11px 13px;margin:12px 0;font-size:11px}',
'#cdi-economy-audit-panel .cea-scroll{overflow:auto;max-height:465px;border:1px solid #e1eae3;border-radius:8px}',
'#cdi-economy-audit-panel table{border-collapse:collapse;width:100%;min-width:1450px;font-size:10px}',
'#cdi-economy-audit-panel th{background:#eaf4ed;position:sticky;top:0;text-align:left;padding:9px;color:#315f42;z-index:1;white-space:nowrap}',
'#cdi-economy-audit-panel td{padding:8px 9px;border-bottom:1px solid #e6ede7;color:#435f4c;vertical-align:top}',
'#cdi-economy-audit-panel .cea-num{font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}',
'#cdi-economy-audit-panel .cea-foot{margin-top:12px!important;color:#7a887d!important;font-size:10px!important}',
'@media(max-width:1020px){#cdi-economy-audit-panel .cea-stats{grid-template-columns:repeat(2,minmax(0,1fr))}#cdi-economy-audit-panel .cea-columns{grid-template-columns:1fr}#cdi-economy-audit-panel .cea-filters{grid-template-columns:repeat(2,minmax(140px,1fr))}}',
'@media(max-width:580px){#cdi-economy-audit-panel{padding:15px}#cdi-economy-audit-panel .cea-stats{grid-template-columns:1fr 1fr}#cdi-economy-audit-panel .cea-stat strong{font-size:17px}#cdi-economy-audit-panel .cea-filters{grid-template-columns:1fr}}'
].join('');
document.head.appendChild(style);
host.insertAdjacentElement('afterend',section);
if(!A?.ready){
  section.innerHTML='<h2 id="cea-title">Apuração da economia · conferência pendente</h2><p>Não foi possível carregar os dados conciliados do ERP: '+esc(A?.error||'fonte indisponível')+'. Nenhum resultado provisório será exibido como economia comprovada.</p>';
  return;
}
const summary=A.summary,C=summary.cdi,R=summary.reuse;
const stat=(label,value,desc)=>'<div class="cea-stat"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong><span>'+esc(desc)+'</span></div>';
section.innerHTML=[
'<div class="cea-eyebrow">AUDITORIA DE BENEFÍCIO ECONÔMICO · DESDE 07/05/2026</div>',
'<h2 id="cea-title">Quanto conseguimos evitar em compras?</h2>',
'<p>São dois benefícios distintos: reaproveitar materiais que já existiam e comprar mais barato pelo CDI. Os valores de transferência não são automaticamente economia.</p>',
'<div class="cea-stats">',
stat('Compra evitada · base gerencial',fmt(R.erpCents),R.count+' transferências de materiais parados'),
stat('Vantagem bruta de preço · CDI',fmt(C.grossComparisonCents),C.destinationComparisons+' comparações com histórico do destino'),
stat('Economia financeira validada','Em apuração','Faltam comprovação da compra evitada e custos adicionais'),
stat('Comparações de preço do CDI',C.destinationComparisons+' de '+C.count,'Mesmo código, unidade, fazenda e até 365 dias antes'),
'</div>',
'<div class="cea-warning"><strong>Leitura correta para a diretoria:</strong> '+fmt(R.erpCents)+' é o custo histórico reaproveitado, não uma economia financeira certificada. '+
'A vantagem bruta de '+fmt(C.grossComparisonCents)+' considera preços anteriores da unidade de destino, inclusive resultados negativos. '+
'<strong>Não somar os indicadores como economia comprovada</strong> enquanto não houver evidência de compra substituída e custos de logística.</div>',
'<div class="cea-columns">',
'<div class="cea-card"><h3>1. Reaproveitamento entre fazendas</h3>',
'<div class="cea-pair"><span>Material reaproveitado ao custo ERP</span><strong>'+fmt(R.erpCents)+'</strong></div>',
'<div class="cea-pair"><span>Uso final na Fazenda Chuá</span><strong>'+fmt(R.finalUseChuaCents)+'</strong></div>',
'<div class="cea-pair"><span>Demais unidades</span><strong>'+fmt(R.erpCents-R.finalUseChuaCents)+'</strong></div>',
'<div class="cea-pair"><span>Com compra histórica no destino</span><strong>'+R.destinationComparisons+' / '+R.count+' registros</strong></div>',
'<div class="cea-pair"><span>Valor de compra alternativa desses registros</span><strong>'+fmt(R.historicalAvoidedPurchaseCents)+'</strong></div>',
'<p class="cea-note">O preço alternativo é apenas referência: ainda precisamos comprovar que uma nova compra seria necessária. O custo já incorrido no estoque não deve ser abatido uma segunda vez.</p></div>',
'<div class="cea-card"><h3>2. Distribuição pelo CDI de Peças</h3>',
'<div class="cea-pair"><span>Material distribuído, sem perdas D410</span><strong>'+fmt(C.erpCents)+'</strong></div>',
'<div class="cea-pair"><span>Comparações no destino</span><strong>'+C.destinationComparisons+' / '+C.count+' registros</strong></div>',
'<div class="cea-pair"><span>Diferenças favoráveis de preço</span><strong>'+fmt(C.positiveCents)+'</strong></div>',
'<div class="cea-pair"><span>Diferenças desfavoráveis de preço</span><strong>'+fmt(C.negativeCents)+'</strong></div>',
'<div class="cea-pair"><span><b>Saldo bruto das diferenças</b></span><strong>'+fmt(C.grossComparisonCents)+'</strong></div>',
'<p class="cea-note">Mantemos diferenças negativas e produtos sem referência. Logística e confirmações de compra evitada ainda não estão auditadas.</p></div>',
'</div>',
'<details id="cea-docs"><summary>Consultar produtos, preços de referência e documentos do ERP</summary>',
'<div class="cea-detail"><div class="cea-filters">',
'<label>Tipo de operação<select id="cea-type"><option value="">Todas</option><option value="CDI">Distribuição CDI</option><option value="REUSO">Reaproveitamento</option></select></label>',
'<label>Referência de preço<select id="cea-status"><option value="">Todas</option><option value="MESMO_DESTINO">Compra no destino</option><option value="OUTRA_UNIDADE">Compra de outra unidade</option><option value="SEM_REFERENCIA">Sem referência</option></select></label>',
'<label>Fazenda destino<select id="cea-dest"><option value="">Todos os destinos</option></select></label>',
'<label>Pesquisar<input id="cea-search" placeholder="Produto, código, NF..."></label>',
'<button type="button" id="cea-reset">Limpar</button>',
'</div>',
'<div class="cea-rollup"><div><strong id="cea-count">—</strong> lançamentos · Total transferido <strong id="cea-total">—</strong> · Saldo comparativo CDI <strong id="cea-diff">—</strong></div><button type="button" id="cea-export">Exportar auditoria CSV</button></div>',
'<div class="cea-scroll"><table><thead><tr>',
['Tipo','Transferência','Fazenda destino','Código / produto','Quantidade','Unidade','Valor ERP','Preço histórico do destino','Compra ref. Nº','Data ref.','Diferença CDI','Situação'].map(h=>'<th>'+esc(h)+'</th>').join(''),
'</tr></thead><tbody id="cea-rows"></tbody></table></div>',
'<p class="cea-foot">Fonte: compras ERP até '+esc(summary.purchasesAuditThrough)+'; janela de 365 dias anteriores a cada transferência. Comparação: código e unidade de medida idênticos; preço de referência = total da nota de compra ÷ quantidade. Campos sem documento não entram na economia validada.</p>',
'</div></details>'
].join('');
const $=id=>section.querySelector('#'+id);
const type=$('cea-type'),status=$('cea-status'),dest=$('cea-dest'),search=$('cea-search');
const destinations=[...new Set(A.rows.map(x=>x.destinationCode))].sort();
for(const code of destinations){const d=A.rows.find(x=>x.destinationCode===code);const option=document.createElement('option');option.value=code;option.textContent=d.destination+' · '+code;dest.appendChild(option)}
let shown=[];
const ds=r=>r.date.slice(8)+'/'+r.date.slice(5,7)+'/'+r.date.slice(0,4);
const classify=r=>r.referenceKind==='MESMO_DESTINO'?'Preço do destino · revisar':r.referenceKind==='OUTRA_UNIDADE'?'Só preço de outra unidade':'Sem compra comparável';
function render(){
 const q=search.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 shown=A.rows.filter(r=>(!type.value||r.type===type.value)&&(!status.value||r.referenceKind===status.value)&&(!dest.value||r.destinationCode===dest.value)&&
 (!q||[r.product,r.code,r.destination,r.invoice,r.document,r.referenceInvoice,r.referenceDocument].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q)))
 .sort((a,b)=>b.erpCents-a.erpCents);
 $('cea-count').textContent=shown.length;
 $('cea-total').textContent=fmt(shown.reduce((s,r)=>s+r.erpCents,0));
 $('cea-diff').textContent=fmt(shown.reduce((s,r)=>s+(r.grossComparisonCents||0),0));
 $('cea-export').disabled=!shown.length;
 $('cea-rows').innerHTML=shown.length?shown.map(r=>'<tr>'+
  '<td>'+esc(r.type==='CDI'?'CDI':'Reaproveitamento')+'</td>'+
  '<td>'+esc('NF '+r.invoice+' · '+r.document+'/'+r.sequence)+'</td>'+
  '<td>'+esc(r.destination)+'</td>'+
  '<td><b>'+esc(r.code)+'</b><div>'+esc(r.product)+'</div></td>'+
  '<td class="cea-num">'+esc(qty.format(r.quantity))+'</td>'+
  '<td>'+esc(r.unit)+'</td>'+
  '<td class="cea-num">'+fmt(r.erpCents)+'</td>'+
  '<td class="cea-num">'+(r.referenceUnitPrice!=null?money.format(r.referenceUnitPrice):'—')+'</td>'+
  '<td>'+esc(r.referenceDocument?r.referenceInvoice+' · '+r.referenceDocument:'—')+'</td>'+
  '<td>'+esc(r.referenceDate||'—')+'</td>'+
  '<td class="cea-num">'+(r.grossComparisonCents==null?'—':fmt(r.grossComparisonCents))+'</td>'+
  '<td>'+esc(classify(r))+'</td></tr>').join(''):
  '<tr><td colspan="12" style="padding:18px">Nenhum registro encontrado com esses filtros.</td></tr>';
}
[type,status,dest].forEach(el=>el.addEventListener('change',render));search.addEventListener('input',render);
$('cea-reset').addEventListener('click',()=>{type.value='';status.value='';dest.value='';search.value='';render()});
$('cea-export').addEventListener('click',()=>{
 const cols=['Tipo','Data','NF transferencia','NUNOTA transferencia','Sequencia','Origem','Destino','Codigo destino','Codigo produto','Produto','Unidade','Quantidade','Valor ERP centavos','Referencia','NF compra','NUNOTA compra','Data compra','Fornecedor','Quantidade compra','Valor compra centavos','Valor referencia centavos','Diferenca bruta CDI centavos','Status'];
 const pack=r=>[r.type,r.date,r.invoice,r.document,r.sequence,r.origin,r.destination,r.destinationCode,r.code,r.product,r.unit,r.quantity,r.erpCents,r.referenceKind,r.referenceInvoice,r.referenceDocument,r.referenceDate,r.referenceSupplier,r.referenceQuantity,r.referenceTotalOriginalCents,r.referenceTotalCents,r.grossComparisonCents,r.reviewStatus];
 const quote=x=>{let v=String(x==null?'':x);if(/^[=+@\-\t\r]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'};
 const contents='\uFEFF'+[cols,...shown.map(pack)].map(row=>row.map(quote).join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([contents],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='apuracao_economia_CDI_reaproveitamento.csv';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),500);
});
render();
})();
