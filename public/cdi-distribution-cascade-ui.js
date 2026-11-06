// CDI compras: detalhamento em cascata mes -> grupo -> produto, sem impacto no ERP.
(function(){
'use strict';
if(document.documentElement.dataset.cdiPurchaseCascade==='1'||document.documentElement.dataset.dbPilot==='1')return;
const host=document.getElementById('cdi-distribution-purchases'),source=window.CDI_DISTRIBUTION_PURCHASES,packed=window.CDI_DISTRIBUTION_DETAIL_GZIP;
if(!host||!source||!packed)return;
document.documentElement.dataset.cdiPurchaseCascade='1';
const details=host.querySelector('details'),old=details.querySelector('.dp-dual'),oldFoot=details.querySelector('.dp-foot');
const fmt=new Intl.NumberFormat('pt-BR'),money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const br=n=>money.format(n/100),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const state={month:'',group:'',product:'',search:''};let rows=[];
const ui=document.createElement('div');ui.id='dp-cascade';ui.innerHTML=[
'<p class="dp-label">Filtro em cascata: mês → grupo → produto → notas fiscais</p>',
'<div class="dp-controls">',
'<label>1. Mês<select id="dp-month"><option value="">Todos os meses</option></select></label>',
'<label>2. Grupo<select id="dp-group"><option value="">Todos os grupos</option></select></label>',
'<label>3. Produto<select id="dp-product"><option value="">Todos os produtos</option></select></label>',
'<label>Pesquisar<input id="dp-search" type="search" placeholder="Código, NF ou fornecedor"></label>',
'<button id="dp-reset" type="button">Limpar filtros</button></div>',
'<p id="dp-trail"></p>',
'<div class="dp-total"><div><small>Valor filtrado</small><strong id="dp-val">—</strong></div><div><small>Registros</small><strong id="dp-count">—</strong></div><div><small>Produtos/UN</small><strong id="dp-skus">—</strong></div></div>',
'<div class="dp-tables">',
'<div><h3>Por mês · clique para filtrar</h3><div class="dp-table"><table><thead><tr><th>Mês</th><th>Linhas</th><th>Total</th></tr></thead><tbody id="dp-months"></tbody></table></div></div>',
'<div><h3>Por grupo · clique para filtrar</h3><div class="dp-table"><table><thead><tr><th>Grupo</th><th>Linhas</th><th>Total</th></tr></thead><tbody id="dp-groups"></tbody></table></div></div></div>',
'<h3>Produtos comprados · maior valor primeiro</h3><div class="dp-table"><table><thead><tr><th>Produto</th><th>UN</th><th>Linhas</th><th>Total</th></tr></thead><tbody id="dp-products"></tbody></table></div>',
'<h3>Lançamentos individuais do ERP</h3><div class="dp-table dp-documents"><table><thead><tr><th>Data</th><th>NF</th><th>Produto</th><th>Fornecedor</th><th>Qtd.</th><th>UN</th><th>Preço unit.</th><th>Valor</th><th>Recebimento</th></tr></thead><tbody id="dp-records"></tbody></table></div>',
'<p class="dp-remark">Compras destinadas à distribuição não representam transferências realizadas nem economia.</p>',
'<button type="button" id="dp-export">Exportar compras filtradas CSV</button>'
].join('');
old.insertAdjacentElement('beforebegin',ui);
old.style.display='none';if(oldFoot)oldFoot.style.display='none';
const css=document.createElement('style');css.textContent=[
'#dp-cascade{color:#175a35;padding:10px 0}#dp-cascade .dp-label{font-size:11px;font-weight:800;margin:0 0 12px}',
'#dp-cascade .dp-controls{display:grid;grid-template-columns:1fr 1.1fr 1.8fr 1.1fr auto;gap:9px;align-items:end}',
'#dp-cascade .dp-controls label{min-width:0;color:#576f60;font-size:10px;font-weight:850}',
'#dp-cascade .dp-controls select,#dp-cascade .dp-controls input{display:block;width:100%;height:35px;margin-top:5px;padding:6px;border:1px solid #cbded0;border-radius:7px;background:#fff;font-size:11px}',
'#dp-cascade #dp-reset,#dp-cascade #dp-export{height:35px;border-radius:7px;border:1px solid #c3dcc9;background:#eaf8ed;color:#145c34;font-weight:800;font-size:11px;padding:0 10px;cursor:pointer}',
'#dp-cascade #dp-trail{font-size:11px;color:#518564;padding:10px 0;font-weight:800}',
'#dp-cascade .dp-total{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}',
'#dp-cascade .dp-total>div{background:#f6faf7;border:1px solid #deede1;border-radius:9px;padding:10px}',
'#dp-cascade .dp-total small{display:block;text-transform:uppercase;font-size:9px;color:#6a806e}',
'#dp-cascade .dp-total strong{font-size:17px}',
'#dp-cascade .dp-tables{display:grid;grid-template-columns:1fr 1.45fr;gap:12px;margin-bottom:13px}',
'#dp-cascade h3{font-size:11px;margin:12px 0 6px;color:#155b35}',
'#dp-cascade .dp-table{max-height:310px;overflow:auto;border:1px solid #ddebe0;border-radius:8px}',
'#dp-cascade table{width:100%;border-collapse:collapse;font-size:10px}',
'#dp-cascade .dp-documents table{min-width:1020px}',
'#dp-cascade th{position:sticky;top:0;background:#145b35!important;color:#fff!important;text-align:left;padding:8px}',
'#dp-cascade td{padding:8px;border-bottom:1px solid #edf2ee}',
'#dp-cascade td:last-child{text-align:right;white-space:nowrap;font-weight:750}',
'#dp-cascade tr[data-dp-type]{cursor:pointer}#dp-cascade tr[data-dp-type]:hover{background:#e9f7ed}',
'#dp-cascade tr.dp-on{background:#e0f3e5}',
'#dp-cascade .dp-remark{font-size:10px;color:#697d6c;margin:12px 0!important}',
'@media(max-width:1050px){#dp-cascade .dp-controls{grid-template-columns:repeat(3,minmax(0,1fr))}}',
'@media(max-width:650px){#dp-cascade .dp-controls{grid-template-columns:1fr 1fr}#dp-cascade .dp-tables{grid-template-columns:1fr}#dp-cascade .dp-total{grid-template-columns:1fr}}'
].join('');document.head.appendChild(css);
const $=s=>ui.querySelector(s),formatMonth=s=>s.slice(5)+'/'+s.slice(0,4),formatDate=s=>s.slice(6,8)+'/'+s.slice(4,6)+'/'+s.slice(0,4);
const unique=(list,key)=>[...new Set(list.map(x=>x[key]))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
function aggr(list,fn){
 const m=new Map();for(const r of list){const k=fn(r),v=m.get(k)||{key:k,count:0,sum:0};v.count++;v.sum+=r.total;m.set(k,v)}
 return [...m.values()].sort((a,b)=>b.sum-a.sum||a.key.localeCompare(b.key,'pt-BR'));
}
function options(id,vals,label,placeholder,current){
 const node=$(id);node.innerHTML='<option value="">'+esc(placeholder)+'</option>'+
 vals.map(v=>'<option value="'+esc(v)+'">'+esc(label(v))+'</option>').join('');
 node.value=vals.includes(current)?current:'';return node.value;
}
function matches(r){return !state.search||norm([r.code,r.product,r.supplier,r.nf,r.id,r.group].join(' ')).includes(norm(state.search))}
function filtered(){return rows.filter(r=>(!state.month||r.month===state.month)&&(!state.group||r.group===state.group)&&(!state.product||r.productKey===state.product)&&matches(r))}
function listing(id,list,type,label){
 $(id).innerHTML=list.map(x=>'<tr tabindex="0" role="button" data-dp-type="'+type+'" data-dp-key="'+esc(x.key)+'" class="'+(state[type]===x.key?'dp-on':'')+'"><td>'+esc(label(x.key))+'</td><td>'+fmt.format(x.count)+'</td><td>'+br(x.sum)+'</td></tr>').join('');
}
function render(){
 state.month=options('#dp-month',unique(rows,'month'),formatMonth,'Todos os meses',state.month);
 const a=rows.filter(r=>!state.month||r.month===state.month);
 state.group=options('#dp-group',unique(a,'group'),x=>x,'Todos os grupos',state.group);
 const b=a.filter(r=>!state.group||r.group===state.group);
 const prods=unique(b,'productKey');
 state.product=options('#dp-product',prods,k=>{const x=b.find(r=>r.productKey===k);return x.code+' - '+x.product+' ('+x.unit+')'},'Todos os produtos',state.product);
 $('#dp-group').disabled=!a.length;$('#dp-product').disabled=!b.length;
 const list=filtered(),sum=list.reduce((s,r)=>s+r.total,0);
 $('#dp-count').textContent=fmt.format(list.length);$('#dp-val').textContent=br(sum);$('#dp-skus').textContent=fmt.format(new Set(list.map(r=>r.productKey)).size);
 $('#dp-trail').textContent=[state.month?formatMonth(state.month):'Todos os meses',state.group||'Todos os grupos',state.product||'Todos os produtos'].join(' → ');
 listing('#dp-months',aggr(rows.filter(r=>(!state.group||r.group===state.group)&&(!state.product||r.productKey===state.product)&&matches(r)),r=>r.month).sort((a,b)=>b.key.localeCompare(a.key)),'month',formatMonth);
 listing('#dp-groups',aggr(a.filter(matches),r=>r.group),'group',x=>x);
 const products=aggr(list,r=>r.productKey);
 $('#dp-products').innerHTML=products.map(v=>{const r=list.find(x=>x.productKey===v.key);
 return '<tr tabindex="0" role="button" data-dp-type="product" data-dp-key="'+esc(v.key)+'" class="'+(v.key===state.product?'dp-on':'')+'"><td>'+esc(r.code)+' - '+esc(r.product)+'</td><td>'+esc(r.unit)+'</td><td>'+fmt.format(v.count)+'</td><td>'+br(v.sum)+'</td></tr>'}).join('')||'<tr><td colspan="4">Sem produtos.</td></tr>';
 $('#dp-records').innerHTML=list.slice().sort((a,b)=>b.date-a.date||b.total-a.total).map(r=>'<tr><td>'+formatDate(r.date)+'</td><td>'+esc(r.nf)+'</td><td>'+esc(r.code)+' - '+esc(r.product)+'</td><td>'+esc(r.supplier)+'</td><td>'+fmt.format(r.qty)+'</td><td>'+esc(r.unit)+'</td><td>'+money.format(r.unitPrice)+'</td><td>'+br(r.total)+'</td><td>'+esc(r.status)+'</td></tr>').join('')||'<tr><td colspan="9">Sem lançamentos.</td></tr>';
 source.filteredSummary={lines:list.length,cents:sum,month:state.month,group:state.group,product:state.product};
}
function change(type,value){state[type]=value;if(type==='month'){state.group='';state.product='';}else if(type==='group')state.product='';render();}
['month','group','product'].forEach(type=>$('#dp-'+type).addEventListener('change',e=>change(type,e.target.value)));
$('#dp-search').addEventListener('input',e=>{state.search=e.target.value;render()});
$('#dp-reset').addEventListener('click',()=>{state.month=state.group=state.product=state.search='';$('#dp-search').value='';render()});
ui.addEventListener('click',e=>{const row=e.target.closest('[data-dp-type]');if(row)change(row.dataset.dpType,row.dataset.dpKey===state[row.dataset.dpType]?'':row.dataset.dpKey)});
ui.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-dp-type]')){e.preventDefault();e.target.click()}});
$('#dp-export').addEventListener('click',()=>{
 const cols=['Data','NF','Nrounico','Sequencia','Codigo','Grupo','Produto','Unidade','Quantidade','Preco unitario','Valor','Fornecedor','Status','Empresa compradora','Linha fonte'];
 const values=filtered().map(r=>[formatDate(r.date),r.nf,r.id,r.seq,r.code,r.group,r.product,r.unit,r.qty,r.unitPrice,r.total/100,r.supplier,r.status,r.buyer,r.line]);
 const safe=v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
 const blob=new Blob(['\ufeff'+[cols,...values].map(a=>a.map(safe).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 const link=URL.createObjectURL(blob),a=document.createElement('a');a.href=link;a.download='compras_distribuicao_30115.csv';a.click();setTimeout(()=>URL.revokeObjectURL(link),1000);
});
async function boot(){
 const decoded=Uint8Array.from(atob(packed),c=>c.charCodeAt(0));
 const json=await new Response(new Blob([decoded]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
 const obj=JSON.parse(json);
 if(obj.v!==1||!obj.d||!Array.isArray(obj.r))throw Error('Formato invalido');
 const d=obj.d;
 rows=obj.r.map(r=>({date:String(r[0]),month:String(r[0]).slice(0,4)+'-'+String(r[0]).slice(4,6),
 id:r[1],nf:r[2],seq:r[3],code:String(r[4]),group:d.group[r[5]],product:d.product[r[6]],unit:d.unit[r[7]],
 supplier:d.supplier[r[8]],qty:r[9],unitPrice:r[10]/10000,total:r[11],status:d.status[r[12]],buyer:d.buyCompany[r[13]],line:r[14],
 productKey:String(r[4])+'|'+d.unit[r[7]]}));
 if(rows.length!==256||rows.reduce((s,r)=>s+r.total,0)!==15019467||new Set(rows.map(r=>r.productKey)).size!==208)throw Error('Totais nao conferem');
 if(new Set(rows.map(r=>r.id+'|'+r.seq+'|'+r.code+'|'+r.unit)).size!==256)throw Error('Linhas duplicadas');
 for(const x of source.groups){const a=rows.filter(r=>r.group===x.name);if(a.length!==x.lines||a.reduce((s,r)=>s+r.total,0)!==x.valueCents)throw Error('Grupo nao confere: '+x.name)}
 for(const x of source.months){const a=rows.filter(r=>r.month===x.month);if(a.length!==x.lines||a.reduce((s,r)=>s+r.total,0)!==x.valueCents)throw Error('Mes nao confere: '+x.month)}
 source.detailRows=rows;render();source.cascade={getRows:()=>rows.slice(),getState:()=>({...state}),reset:()=>$('#dp-reset').click()};
}
boot().catch(e=>{ui.innerHTML='<p role="alert">Erro ao conferir dados CDI: '+esc(e.message)+'</p>';old.style.display='grid';if(oldFoot)oldFoot.style.display=''});
})();