// Indicador gerencial de materiais reaproveitados em outras fazendas.
// Não mistura consumo final na Chuá com distribuição comercial do CDI ou perdas D410.
(function(){
'use strict';
if(document.documentElement.dataset.dbPilot==='1'||document.documentElement.dataset.dbPilot==='chua')return;
const ledger=window.DB_REALLOCATION_REUSE,host=document.getElementById('cdi-transfer-panel');
if(!host||!ledger||ledger.schemaVersion!==1||document.getElementById('reallocation-reuse-panel'))return;
const rows=ledger.transfers||[],audit=ledger.audit||{};
const add=a=>a.reduce((s,r)=>s+Number(r.costCents||0),0);
const used=rows.filter(r=>r.classification==='USO_FINAL_CHUA');
const other=rows.filter(r=>r.classification==='REAPROVEITAMENTO_OPERACIONAL');
if(rows.length!==24||used.length!==4||other.length!==20||add(rows)!==1115229||add(used)!==153093||add(other)!==962136||
  audit.eligibleValueCents!==1115229||audit.finalUseChuaCents!==153093)
  throw Error('Conferencia de reaproveitamento do ERP inconsistente');
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}),fmt=n=>money.format(n/100);
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const x=document.createElement('section');
x.id='reallocation-reuse-panel';
x.style.cssText='border:1px solid #d3e6d9;border-left:4px solid #18764b;border-radius:12px;padding:16px;margin:14px 0;background:white;color:#204a31;font-family:inherit';
x.innerHTML='<div style="font-size:10px;font-weight:850;letter-spacing:.05em;color:#418260">REAPROVEITAMENTO DE ESTOQUES · DESDE 07/05/2026</div>'+
'<h2 style="font-size:16px;margin:6px 0 8px">Compras evitadas por realocação de materiais</h2>'+
'<p style="font-size:12px;color:#587565;line-height:1.5;margin:0 0 12px">Materiais parados em outras fazendas transferidos para locais que os utilizam. Os quatro envios da São João para a Fazenda Chuá foram usados na própria fazenda: <b>uso final, sem redistribuição pelo CDI</b>.</p>'+
'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:9px;margin:10px 0">'+
'<div style="padding:12px;background:#f0f8f3;border-radius:9px"><small>Valor reaproveitado a custo ERP</small><strong style="display:block;font-size:22px">'+fmt(add(rows))+'</strong><small>24 linhas conciliadas</small></div>'+
'<div style="padding:12px;background:#f5f9f5;border-radius:9px"><small>Uso final na Fazenda Chuá</small><strong style="display:block;font-size:20px">'+fmt(add(used))+'</strong><small>4 linhas · origem São João</small></div>'+
'<div style="padding:12px;background:#f5f9f5;border-radius:9px"><small>Reaproveitamento em outras unidades</small><strong style="display:block;font-size:20px">'+fmt(add(other))+'</strong><small>20 linhas</small></div></div>'+
'<p style="font-size:11px;color:#74602e;margin:10px 0">Metodologia: valor da saída do ERP como referência gerencial de compra evitada, <b>não economia de preço comprovada</b>. Sem contabilizar perdas D410, transferências para granjas fora do escopo ou duplicar a distribuição do CDI. Nenhum saldo físico é alterado.</p>'+
'<details><summary style="cursor:pointer;font-weight:800;font-size:12px;margin:10px 0">Ver documentos e materiais realocados</summary>'+
'<div style="overflow:auto;max-height:410px"><table style="border-collapse:collapse;min-width:1000px;width:100%;font-size:11px"><thead><tr>'+
['Data','Origem','Destino','Documento','Código','Material','Qtd.','Un.','Custo ERP','Classificação'].map(c=>'<th style="position:sticky;top:0;background:#e6f2e9;text-align:left;padding:8px;white-space:nowrap">'+esc(c)+'</th>').join('')+
'</tr></thead><tbody>'+
rows.slice().sort((a,b)=>b.costCents-a.costCents).map(r=>'<tr>'+
[r.date.split('-').reverse().join('/'),r.origin,r.destination,r.document+' / '+r.seq,r.productCode,r.product,r.quantity.toLocaleString('pt-BR'),r.unit,fmt(r.costCents),r.classification==='USO_FINAL_CHUA'?'Uso final Chuá':'Reaproveitamento'].map(v=>'<td style="padding:8px;border-bottom:1px solid #e4eee7">'+esc(v)+'</td>').join('')+
'</tr>').join('')+'</tbody></table></div></details>';
host.insertAdjacentElement('afterend',x);
window.DB_REALLOCATION_CONTROL={summary:{records:rows.length,valueCents:add(rows),finalUseChuaCents:add(used),otherCents:add(other)},getRows:()=>rows.slice()};
})();
