// Controle historico de solicitacoes de compras Sankhya - CDI Chua, local 30115.
// Ciclo por grupo: proxima solicitacao = ultima emissao + 2 meses; aviso 15 dias antes.
(function(){
'use strict';
if(window.DB_CDI_ORDER_TRACKER)return;
const tabs=document.querySelector('.tabs'),root=document.querySelector('.wrap');
if(!tabs||!root)return;
const tab=document.createElement('button');tab.type='button';tab.className='tab';
tab.dataset.view='compras-programadas';tab.textContent='Solicitacoes CDI · 2 meses';tabs.appendChild(tab);
const view=document.createElement('section');view.className='view';view.id='view-compras-programadas';root.appendChild(view);
const data=window.DB_CDI_REQUESTS_DATA||{requests:[],policy:{cadenceMonths:2,alertBeforeDays:15}};
const cadence=Number(data.policy?.cadenceMonths)||2,alertDays=Number(data.policy?.alertBeforeDays)||15;
const state={search:'',status:'all',open:new Set()};
const str=x=>String(x??''),norm=x=>str(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
const esc=x=>str(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=x=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(Number(x)||0);
const int=x=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(Number(x)||0);
const parse=d=>{const a=str(d).split('-').map(Number);return a.length===3?new Date(Date.UTC(a[0],a[1]-1,a[2])):null};
const iso=d=>d?d.toISOString().slice(0,10):'';
const display=d=>d?d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4):'—';
const plusMonths=(date,months)=>{
  const d=parse(date);if(!d)return null;
  const n=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+months,1));
  const last=new Date(Date.UTC(n.getUTCFullYear(),n.getUTCMonth()+1,0)).getUTCDate();
  n.setUTCDate(Math.min(d.getUTCDate(),last));return n;
};
const today=()=>{const n=new Date();return new Date(Date.UTC(n.getFullYear(),n.getMonth(),n.getDate()))};
const days=(future,now)=>Math.round((future-now)/86400000);
const documents=(data.requests||[]).map(x=>({...x,group:norm(x.group)||'SEM GRUPO'}))
  .sort((a,b)=>b.issuedAt.localeCompare(a.issuedAt)||str(b.requestNumber).localeCompare(str(a.requestNumber)));
const grouped=new Map();
for(const d of documents){if(!grouped.has(d.group))grouped.set(d.group,[]);grouped.get(d.group).push(d)}
const groups=[...grouped].map(([name,docs])=>({
  name,docs,latest:docs[0],products:new Set(docs.flatMap(d=>d.items.map(x=>x.code)))
}));
function status(g){
  const due=plusMonths(g.latest.issuedAt,cadence);
  if(!due)return {code:'unknown',text:'Sem data',due:null,days:0};
  const remaining=days(due,today());
  return {code:remaining<0?'late':remaining<=alertDays?'soon':'ok',
    text:remaining<0?'Prazo vencido':remaining<=alertDays?'Solicitar em breve':'Em dia',
    days:remaining,due};
}
const enriched=groups.map(g=>({...g,status:status(g)})).sort((a,b)=>
  ({late:0,soon:1,ok:2,unknown:3}[a.status.code]-{late:0,soon:1,ok:2,unknown:3}[b.status.code])||
  a.status.days-b.status.days||a.name.localeCompare(b.name,'pt-BR'));
const style=document.createElement('style');style.id='db-cdi-sankhya-tracker-style';
style.textContent=[
'#view-compras-programadas{font:12px Arial,Helvetica,sans-serif;color:#244932;padding-bottom:24px}',
'#view-compras-programadas *{box-sizing:border-box}',
'#view-compras-programadas .sc-head{background:linear-gradient(110deg,#0c4927,#17733e);border-bottom:4px solid #faca04;border-radius:12px;padding:22px;color:white}',
'#view-compras-programadas .sc-head h2{color:white;font-size:23px;margin:0 0 7px}',
'#view-compras-programadas .sc-head p{font-size:12px;line-height:1.6;margin:0;max-width:990px;color:#e7f5ea}',
'#view-compras-programadas .sc-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}',
'#view-compras-programadas .sc-stat{background:white;border:1px solid #dce8df;border-top:3px solid #1b783f;border-radius:9px;padding:14px;min-width:0}',
'#view-compras-programadas .sc-stat.warning{border-top-color:#e4b313}',
'#view-compras-programadas .sc-stat span,#view-compras-programadas .sc-stat small{display:block;color:#62796a;font-size:10px;line-height:1.5}',
'#view-compras-programadas .sc-stat strong{display:block;font-size:23px;color:#135c32;margin:5px 0}',
'#view-compras-programadas .sc-alert{padding:13px 15px;background:#fff8e4;border:1px solid #e5d9b0;border-radius:8px;margin-bottom:12px;line-height:1.6}',
'#view-compras-programadas .sc-alert.ok{background:#edf8f1;border-color:#d3e7d9}',
'#view-compras-programadas .sc-filter{display:flex;gap:12px;align-items:end;flex-wrap:wrap;padding:13px;background:white;border:1px solid #dce8df;border-radius:9px;margin-bottom:13px}',
'#view-compras-programadas .sc-filter label{display:flex;flex-direction:column;gap:6px;font-size:11px;font-weight:bold;min-width:180px}',
'#view-compras-programadas .sc-filter label.search{flex:1;min-width:240px}',
'#view-compras-programadas input,#view-compras-programadas select{border:1px solid #c5d7ca;border-radius:6px;padding:9px;min-height:38px;color:#244b31;background:#fff}',
'#view-compras-programadas .sc-button{border:1px solid #bbd8c5;background:#ecf7ef;color:#165c32;font-size:11px;font-weight:bold;border-radius:6px;padding:10px 12px;cursor:pointer}',
'#view-compras-programadas .sc-panel{border:1px solid #dce9df;background:white;border-radius:10px;overflow:hidden}',
'#view-compras-programadas .sc-title{padding:13px 16px;background:#edf7f0;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}',
'#view-compras-programadas .sc-title h3{font-size:15px;color:#135d32;margin:0}',
'#view-compras-programadas .sc-groups{padding:12px}',
'#view-compras-programadas .sc-group{border:1px solid #dce9df;border-radius:8px;overflow:hidden;margin-bottom:10px}',
'#view-compras-programadas .sc-group button{border:0;width:100%;padding:14px;background:#f4faf6;color:#185e36;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;text-align:left;cursor:pointer}',
'#view-compras-programadas .sc-group button[aria-expanded=true]{background:#e7f3eb;border-bottom:1px solid #c9ddce}',
'#view-compras-programadas .sc-group strong{font-size:14px}',
'#view-compras-programadas .sc-group .summary{display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:11px}',
'#view-compras-programadas .sc-status{display:inline-block;border-radius:5px;background:#e6f5ea;color:#19653b;padding:5px 7px;font-size:10px;font-weight:bold}',
'#view-compras-programadas .sc-status.soon{background:#fff1c4;color:#805a0a}',
'#view-compras-programadas .sc-status.late{background:#ffe5dc;color:#a33822}',
'#view-compras-programadas .sc-details{padding:13px}',
'#view-compras-programadas details{border:1px solid #e0ebe3;border-radius:7px;overflow:hidden;margin:8px 0}',
'#view-compras-programadas summary{cursor:pointer;padding:12px;background:#f9fcfa;font-weight:bold;color:#235b3a}',
'#view-compras-programadas summary small{display:block;color:#67816f;font-size:10px;margin-top:5px;font-weight:normal}',
'#view-compras-programadas .sc-meta{display:flex;gap:12px;flex-wrap:wrap;padding:12px;color:#5e7465}',
'#view-compras-programadas .sc-scroll{max-height:460px;overflow:auto}',
'#view-compras-programadas table{width:100%;min-width:650px;border-collapse:collapse;font-size:11px}',
'#view-compras-programadas th,#view-compras-programadas td{text-align:left;padding:9px;border-bottom:1px solid #e4eee7}',
'#view-compras-programadas th{background:#edf7f0;color:#235b37;position:sticky;top:0}',
'#view-compras-programadas td.qty{text-align:right;font-weight:bold}',
'#view-compras-programadas .sc-note{padding:11px 14px;font-size:10px;line-height:1.7;color:#607768;border-top:1px solid #e5ede8}',
'@media(max-width:900px){#view-compras-programadas .sc-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}',
'@media(max-width:550px){#view-compras-programadas .sc-stats{grid-template-columns:1fr}}'
].join('');
document.head.appendChild(style);
view.innerHTML='<div class="sc-head"><h2>Controle de Solicitações · CDI de Peças</h2>'+
'<p>Histórico dos pedidos de reposição encaminhados ao setor de Compras pelo Sankhya. '+
'Organização por <b>grupo → solicitação → itens</b>. O destino de todos os pedidos é <b>CDI Chuá, local 30115</b>. '+
'A data de emissão serve de referência para solicitar novamente a cada 2 meses. '+
'Uma solicitação emitida não comprova compra, aprovação nem recebimento.</p></div>'+
'<div id="sc-stat-area"></div><div id="sc-alert-area"></div>'+
'<div class="sc-filter"><label class="search">Buscar grupo, produto, código ou solicitação<input id="sc-search" type="search" placeholder="Pesquisar histórico"></label>'+
'<label>Situação<select id="sc-status"><option value="all">Todas</option><option value="late">Prazo vencido</option>'+
'<option value="soon">Solicitar em breve</option><option value="ok">Em dia</option></select></label>'+
'<button class="sc-button" id="sc-export" type="button">Exportar histórico CSV</button></div>'+
'<div class="sc-panel"><div class="sc-title"><h3>Solicitações por grupo e itens</h3><small id="sc-count"></small></div>'+
'<div class="sc-groups" id="sc-groups"></div>'+
'<div class="sc-note"><b>Prazo:</b> data da última solicitação do grupo + 2 meses de calendário. '+
'O alerta surge 15 dias antes e permanece após o vencimento até um novo pedido ser registrado. '+
'Este aviso é exibido no dashboard, sem envio de mensagens externas. '+
'Grupos sem documentação enviada não recebem datas presumidas.</div></div>';
const el=x=>view.querySelector(x);
function filtered(){
  const key=norm(state.search);
  return enriched.filter(g=>(state.status==='all'||g.status.code===state.status)&&
    (!key||norm([g.name,...g.docs.flatMap(d=>[d.requestNumber,d.uniqueNumber,d.quotationNumber,
      ...d.items.flatMap(i=>[i.code,i.description])])].join(' ')).includes(key)));
}
function purchaseReconciliation(doc){
  const order=str(doc.uniqueNumber);
  if(!window.DB_PURCHASES_20261113_AUDIT?.ready||typeof PURCHASES==='undefined')
    return {verified:false,matched:0,total:doc.items.length,rows:[],extra:[]};
  const entries=PURCHASES.filter(x=>String(x.observacao||'').includes('PEDIDO DE COMPRA NUMERO '+order)
    &&String(x.codigo_local)==='30115'&&x.status==='LANC.RECEB.');
  const byCode=new Map();
  for(const x of entries){const k=String(x.codigo)+'|'+norm(x.un);
    byCode.set(k,(byCode.get(k)||0)+Number(x.qtd||0));}
  let matched=0;
  const rows=doc.items.map(i=>{
    const received=byCode.get(String(i.code)+'|'+norm(i.unit))||0;
    const status=received>=i.quantity?'LANC. RECEBIMENTO':received>0?'PARCIAL':'SEM RECEBIMENTO NO RELATÓRIO';
    if(received>=i.quantity)matched++;
    return {code:String(i.code),received,status};
  });
  const expected=new Set(doc.items.map(i=>String(i.code)+'|'+norm(i.unit)));
  const extra=entries.filter(i=>!expected.has(String(i.codigo)+'|'+norm(i.un))).map(i=>String(i.codigo));
  return {verified:true,matched,total:doc.items.length,rows,extra};
}
function render(){
  const pending=enriched.filter(g=>['soon','late'].includes(g.status.code));
  const codes=new Set(documents.flatMap(d=>d.items.map(i=>i.code)));
  const card=(name,value,note,warn=false)=>'<div class="sc-stat'+(warn?' warning':'')+'"><span>'+name+'</span>'+
    '<strong>'+int(value)+'</strong><small>'+note+'</small></div>';
  el('#sc-stat-area').innerHTML='<div class="sc-stats">'+
    card('Grupos com solicitações',groups.length,'CDI Chuá / local ERP 30115')+
    card('Solicitações registradas',documents.length,'Histórico do Sankhya')+
    card('Produtos distintos solicitados',codes.size,'Por código de produto')+
    card('Grupos com alerta',pending.length,'15 dias antes de completar 2 meses',pending.length>0)+'</div>';
  const note=pending.length?pending.map(g=>esc(g.name)+' — próximo pedido '+display(iso(g.status.due))+
    (g.status.days<0?' ('+int(-g.status.days)+' dias de atraso)':' ('+int(g.status.days)+' dias restantes)')).join(' · '):
    'Nenhum grupo cadastrado está próximo da data de nova solicitação.';
  el('#sc-alert-area').innerHTML='<div class="sc-alert'+(pending.length?'':' ok')+'"><b>'+
    (pending.length?'Atenção aos próximos pedidos':'Prazos de reposição acompanhados')+'</b><div>'+note+'</div></div>';
  const list=filtered();el('#sc-count').textContent=list.length+' de '+groups.length+' grupos';
  el('#sc-groups').innerHTML=list.map(g=>{
    const open=state.open.has(g.name);
    const docs=open?g.docs.map((d,index)=>{
      const quantity=d.items.reduce((v,i)=>v+Number(i.quantity||0),0);
      const receipt=purchaseReconciliation(d);
      const byProduct=new Map(receipt.rows.map(r=>[r.code,r]));
      const rows=d.items.map(i=>{
        const match=byProduct.get(String(i.code));
        return '<tr><td>'+esc(i.code)+'</td><td>'+esc(i.description)+'</td>'+
          '<td>'+esc(i.unit)+'</td><td class="qty">'+num(i.quantity)+'</td>'+
          '<td>'+esc(match?.status||'SOLICITADO')+
          (match?.received?' · '+num(match.received):'')+'</td></tr>';
      }).join('');
      return '<details '+(index===0?'open':'')+'><summary>Solicitação '+esc(d.requestNumber)+' · '+display(d.issuedAt)+
        (index===0?' · Última solicitação':'')+
        '<small>'+int(d.items.length)+' itens'+(d.items.every(i=>i.unit==='PC')?' · '+num(quantity)+' peças':'')+
        ' · Nº único '+esc(d.uniqueNumber)+'</small></summary>'+
        '<div class="sc-meta"><span><b>Emissão:</b> '+display(d.issuedAt)+'</span>'+
        '<span><b>Solicitação:</b> '+esc(d.requestNumber)+'</span>'+
        '<span><b>Nº único:</b> '+esc(d.uniqueNumber)+'</span>'+
        '<span><b>Cotação:</b> '+esc(d.quotationNumber)+'</span>'+
        '<span><b>Comprador:</b> '+esc(d.buyer)+'</span>'+
        '<span><b>Destino:</b> CDI Chuá (30115)</span></div>'+
        '<div class="sc-scroll"><table><thead><tr><th>Código</th><th>Produto</th><th>UN</th><th>Quantidade solicitada</th><th>Recebimento ERP</th></tr></thead>'+
        '<tbody>'+rows+'</tbody></table></div>'+
        (receipt.verified&&receipt.matched>0?'<div class="sc-note"><b>Conferência por código e unidade:</b> '+int(receipt.matched)+' de '+int(receipt.total)+' itens com lançamento de recebimento no ERP'+
          (receipt.extra.length?' · códigos adicionais na compra não solicitados aqui: '+esc(receipt.extra.join(', ')):'')+
          '. Um lançamento no ERP não comprova conferência física.</div>':'')+
        '<div class="sc-note"><b>Situação documental:</b> solicitação emitida. Sem conferência física independente. '+
        'Fonte: '+esc(d.sourceFile)+'. '+esc(d.note||'')+'. Valores de compra não informados.</div></details>';
    }).join(''):'';
    return '<section class="sc-group" data-sc-group="'+esc(g.name)+'">'+
      '<button type="button" data-sc-toggle="'+esc(g.name)+'" aria-expanded="'+(open?'true':'false')+'">'+
      '<strong>'+(open?'▾':'▸')+' '+esc(g.name)+'</strong>'+
      '<span class="summary"><span>'+int(g.docs.length)+' solicitação(ões) · '+int(g.products.size)+' itens</span>'+
      '<span>Último pedido: <b>'+display(g.latest.issuedAt)+'</b></span>'+
      '<span>Próximo: <b>'+display(iso(g.status.due))+'</b></span>'+
      '<span class="sc-status '+g.status.code+'">'+esc(g.status.text)+'</span></span></button>'+
      (open?'<div class="sc-details">'+docs+'</div>':'')+'</section>';
  }).join('')||'<p>Nenhum pedido corresponde aos filtros.</p>';
  window.DB_CDI_ORDER_TRACKER.meta={
    groups:groups.length,documents:documents.length,lines:documents.reduce((v,d)=>v+d.items.length,0),
    products:codes.size,cadenceMonths:cadence,alertBeforeDays:alertDays,alerts:pending.length,
    nextDue:enriched.map(g=>({group:g.name,date:iso(g.status.due),status:g.status.code})),
    latestRequest:documents[0]?.requestNumber||null,latestDate:documents[0]?.issuedAt||null,
    centralLocal:'30115',source:'SANKHYA',purchasedConfirmed:false,receivedConfirmed:false,
    groupedBy:['Grupo','Solicitação','Item'],externalNotifications:false,
    receipts:documents.map(d=>({request:d.requestNumber,uniqueNumber:d.uniqueNumber,
      ...purchaseReconciliation(d)}))
  };
}
el('#sc-search').addEventListener('input',e=>{state.search=e.target.value;render()});
el('#sc-status').addEventListener('change',e=>{state.status=e.target.value;render()});
window.addEventListener('purchases-updated',render);
el('#sc-export').addEventListener('click',()=>{
  const rows=[['Grupo','Solicitação','N único','N cotação','Emissão','Última solicitação do grupo',
    'Próxima solicitação prevista','Código','Produto','UN','Qtd solicitada','Destino','Situação','Documento fonte']];
  for(const g of filtered())for(const d of g.docs)for(const i of d.items)
    rows.push([g.name,d.requestNumber,d.uniqueNumber,d.quotationNumber,d.issuedAt,g.latest.issuedAt,
      iso(g.status.due),i.code,i.description,i.unit,i.quantity,'CDI Chuá - 30115',d.status,d.sourceFile]);
  const quoted=x=>'"'+str(x??'').replace(/"/g,'""')+'"';
  const blob=new Blob(['\ufeff'+rows.map(row=>row.map(quoted).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='solicitacoes_Sankhya_CDI_Chua.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
});
view.addEventListener('click',e=>{
  const button=e.target.closest('[data-sc-toggle]');if(!button)return;
  const group=button.dataset.scToggle;
  if(state.open.has(group))state.open.delete(group);else state.open.add(group);
  render();
});
tab.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
  tab.classList.add('active');view.classList.add('active');render();
});
if(enriched.length)state.open.add(enriched[0].name);
window.DB_CDI_ORDER_TRACKER={open:()=>tab.click(),refresh:render,meta:null,version:'20261112-sankhya-cdi-v1'};
render();
})();