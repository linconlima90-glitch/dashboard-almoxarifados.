// Consulta detalhada por dia e produto das baixas ERP 2024-2026.
// Carrega dados por ano somente sob demanda e nao modifica consumo/estoque minimo.
(function(){
  function setup(){
    if(window.__DB_MOVEMENT_HISTORY_UI)return true;
    const pack=window.MOVEMENTS_COMPLETE_20261103,host=document.querySelector('#view-baixas');
    if(!pack||!host||document.documentElement.dataset.dbPilot==='1')return false;
    window.__DB_MOVEMENT_HISTORY_UI=true;
  const D=pack.dict,meta=pack.meta;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&quot;'}[c]));
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const integer=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(Number(v)||0);
  const qty=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:4}).format(Number(v)||0);
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const rowsByYear=new Map();let active=[],loading=false,visibleCount=160;
  const yearSet=['2024','2025','2026'];
  const panel=document.createElement('details');panel.id='full-movement-history';panel.className='erp-historical';
  panel.innerHTML=`<summary><span><b>Histórico detalhado das baixas · 2024 a 2026</b><small>Local · grupo · produto · dia | Clique para consultar</small></span><b>19.465 lançamentos</b></summary>
    <div class="erp-h-content">
      <p class="erp-h-warning"><b>Regra do estoque mínimo:</b> 2024 é somente para consulta. A média de reposição utiliza <b>2025 e 2026</b>, de janeiro/2025 a outubro/2026 (22 meses completos). Novembro está parcial.</p>
      <div class="erp-h-years"><div><small>2024 · consulta</small><b>2.350</b><span>R$ 158.911,16</span></div>
        <div><small>2025 · considerado no mínimo</small><b>6.253</b><span>R$ 560.484,33</span></div>
        <div><small>2026 · considerado no mínimo</small><b>10.862</b><span>R$ 1.079.816,82</span></div></div>
      <div class="erp-h-filters">
        <label>Ano<select id="erp-h-year"><option value="2024">2024 · somente consulta</option><option value="2025">2025</option><option value="2026">2026</option></select></label>
        <label>Mês<select id="erp-h-month"><option value="">Todos os meses</option></select></label>
        <label>Almoxarifado<select id="erp-h-local"><option value="">Todos os locais</option></select></label>
        <label>Grupo<select id="erp-h-group"><option value="">Todos os grupos</option></select></label>
        <label>Produto ou código<input type="search" id="erp-h-search" placeholder="Pesquisar produto..."></label>
        <button type="button" id="erp-h-export">Exportar CSV</button>
      </div>
      <p class="erp-h-note">Registros agregados por <b>dia, almoxarifado, empresa fiscal, produto e unidade</b>, preservando a quantidade de lançamentos originais. Custos pelo campo <b>Custo_Total</b> do ERP; sem transferências. A primeira baixa do arquivo é de 14/03/2024.</p>
      <div class="erp-h-result"><b id="erp-h-stat">Selecione um ano para consultar</b><span id="erp-h-value"></span></div>
      <div class="erp-h-wrap"><table><thead><tr><th>Data</th><th>Almoxarifado</th><th>Grupo</th><th>Código / produto</th><th>UN</th><th class="num">Quantidade</th><th class="num">Custo (R$)</th><th class="num">Baixas</th><th>Situação custo</th></tr></thead><tbody id="erp-h-body"></tbody></table></div>
      <div class="erp-h-footer"><span id="erp-h-page-note"></span><button type="button" id="erp-h-more">Mostrar mais</button></div>
    </div>`;
  const style=document.createElement('style');style.textContent=`
    #full-movement-history{border:1px solid #d6e6d9;border-radius:12px;background:#fff;margin:14px 0;overflow:hidden;color:#2c4835}
    #full-movement-history>summary{background:#eaf6ee;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px 17px;cursor:pointer;font-size:13px;color:#0d5830}
    #full-movement-history>summary small{display:block;color:#688071;font-size:10px;margin-top:4px}
    #full-movement-history .erp-h-content{padding:15px}
    #full-movement-history .erp-h-warning{background:#fff9e8;border-left:4px solid #d4a82a;border-radius:7px;padding:11px;font-size:11px;line-height:1.65}
    #full-movement-history .erp-h-years{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:12px 0}
    #full-movement-history .erp-h-years>div{border:1px solid #dae8dc;border-radius:9px;padding:12px;display:grid;gap:3px}
    #full-movement-history .erp-h-years small{font-size:10px;color:#758579;font-weight:800}
    #full-movement-history .erp-h-years b{font-size:21px;color:#165b37}
    #full-movement-history .erp-h-years span{font-size:11px}
    #full-movement-history .erp-h-filters{display:grid;grid-template-columns:1fr 1fr 1.5fr 1.4fr 1.5fr auto;gap:8px;align-items:end;margin:12px 0}
    #full-movement-history .erp-h-filters label{font-size:10px;font-weight:800;color:#5b7463;min-width:0}
    #full-movement-history .erp-h-filters select,#full-movement-history .erp-h-filters input{box-sizing:border-box;display:block;width:100%;min-height:36px;margin-top:5px;border:1px solid #cee0d2;border-radius:6px;padding:7px;background:#fff;font-size:11px}
    #full-movement-history button{background:#e7f6ed;border:1px solid #badac3;border-radius:7px;color:#105c31;cursor:pointer;font-weight:750;padding:9px 12px}
    #full-movement-history .erp-h-note{font-size:11px;line-height:1.5;color:#718073}
    #full-movement-history .erp-h-result{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;font-size:12px;color:#1c623d}
    #full-movement-history .erp-h-wrap{overflow:auto;max-height:520px}
    #full-movement-history table{border-collapse:collapse;min-width:980px;width:100%;font-size:10px}
    #full-movement-history th{background:#125332;color:white;text-align:left;position:sticky;top:0;padding:9px}
    #full-movement-history td{padding:9px;border-bottom:1px solid #e8eee9}
    #full-movement-history .num{text-align:right;white-space:nowrap}
    #full-movement-history .erp-h-check{color:#ad6c17;font-weight:750}
    #full-movement-history .erp-h-footer{display:flex;align-items:center;justify-content:space-between;padding:12px 0 0;font-size:11px;color:#65796c}
    @media(max-width:1050px){#full-movement-history .erp-h-filters{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:690px){#full-movement-history .erp-h-years,#full-movement-history .erp-h-filters{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;document.head.appendChild(style);host.appendChild(panel);
  const $=id=>panel.querySelector(id);
  function label(month){return month.slice(5,7)+'/'+month.slice(0,4)}
  function rowOf(r){
    const [date,li,fi,pi,ui,quantity,cents,count,diff]=r;
    const loc=D.local[li],p=D.product[pi];
    return{date,local:loc[1],codigoLocal:loc[0],empresa:D.company[fi],codigo:p[0],produto:p[1],grupo:D.group[p[2]],un:D.unit[ui],quantity,cents,count,diff};
  }
  function selectedRows(){
    const month=$('#erp-h-month').value,local=$('#erp-h-local').value,grp=$('#erp-h-group').value,q=norm($('#erp-h-search').value);
    return active.filter(x=>(!month||x.date.slice(0,7)===month)&&(!local||x.local===local)&&(!grp||x.grupo===grp)&&
      (!q||norm([x.codigo,x.produto,x.empresa,x.codigoLocal].join(' ')).includes(q)));
  }
  function populate(id,items,labels){
    const sel=$(id),prev=sel.value;
    while(sel.options.length>1)sel.remove(1);
    for(const v of items){const el=document.createElement('option');el.value=v;el.textContent=labels?labels(v):v;sel.add(el)}
    sel.value=items.includes(prev)?prev:'';
  }
  function updateOptions(){
    populate('#erp-h-month',[...new Set(active.map(x=>x.date.slice(0,7)))].sort().reverse(),label);
    populate('#erp-h-local',[...new Set(active.map(x=>x.local))].sort((a,b)=>a.localeCompare(b,'pt-BR')));
    populate('#erp-h-group',[...new Set(active.map(x=>x.grupo))].sort((a,b)=>a.localeCompare(b,'pt-BR')));
  }
  function display(){
    if(loading)return;
    const rows=selectedRows().sort((a,b)=>b.date.localeCompare(a.date)||a.local.localeCompare(b.local,'pt-BR'));
    const totalCents=rows.reduce((sum,r)=>sum+r.cents,0),count=rows.reduce((sum,r)=>sum+r.count,0);
    $('#erp-h-stat').textContent=integer(count)+' baixas · '+integer(rows.length)+' registros agrupados';
    $('#erp-h-value').textContent=money(totalCents/100);
    const show=rows.slice(0,visibleCount);
    $('#erp-h-body').innerHTML=show.map(r=>'<tr><td>'+esc(r.date.slice(8)+'/'+r.date.slice(5,7)+'/'+r.date.slice(0,4))+'</td><td>'+esc(r.local)+'</td><td>'+esc(r.grupo)+'</td><td><b>'+esc(r.codigo)+'</b> · '+esc(r.produto)+'</td><td>'+esc(r.un)+'</td><td class="num">'+qty(r.quantity)+'</td><td class="num">'+money(r.cents/100)+'</td><td class="num">'+integer(r.count)+'</td><td>'+(r.diff?'<span class="erp-h-check">'+r.diff+' DIFERENTE</span>':'IGUAL')+'</td></tr>').join('');
    $('#erp-h-page-note').textContent='Exibindo '+show.length+' de '+rows.length+' linhas';
    $('#erp-h-more').hidden=show.length>=rows.length;
  }
  async function openYear(){
    const year=$('#erp-h-year').value;
    if(!yearSet.includes(year))return;
    loading=true;$('#erp-h-stat').textContent='Carregando histórico '+year+'...';
    $('#erp-h-body').innerHTML='';visibleCount=160;
    try{
      if(!rowsByYear.has(year)){
        const res=await fetch('/baixas-detalhe-'+year+'.json.gz?v=20261103',{cache:'force-cache'});
        if(!res.ok)throw Error('O arquivo do ano '+year+' não está disponível');
        const file=typeof DecompressionStream!=='undefined'
          ? await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).json()
          : await (async()=>{throw Error('Navegador sem suporte a arquivos compactados')})();
        if(String(file.year)!==year||!Array.isArray(file.rows)||
           file.rows.reduce((s,r)=>s+Number(r[7]),0)!==meta.years[year].records)
          throw Error('Totais de '+year+' divergentes no arquivo');
        rowsByYear.set(year,file.rows.map(rowOf));
      }
      active=rowsByYear.get(year);updateOptions();
      loading=false;display();
    }catch(e){loading=false;$('#erp-h-stat').textContent='Falha ao consultar '+year+': '+e.message;$('#erp-h-body').innerHTML='';}
  }
  panel.addEventListener('toggle',()=>{if(panel.open&&!active.length&&!loading)openYear()});
  $('#erp-h-year').addEventListener('change',()=>{active=[];$('#erp-h-local').value='';$('#erp-h-group').value='';$('#erp-h-month').value='';openYear()});
  for(const id of ['#erp-h-month','#erp-h-local','#erp-h-group'])$(id).addEventListener('change',()=>{visibleCount=160;display()});
  $('#erp-h-search').addEventListener('input',()=>{visibleCount=160;display()});
  $('#erp-h-more').addEventListener('click',()=>{visibleCount+=160;display()});
  $('#erp-h-export').addEventListener('click',()=>{
    if(loading||!active.length)return;
    const rows=[['Data','Empresa fiscal','Codigo local','Almoxarifado','Grupo','Codigo','Produto','UN','Quantidade','Custo_Total_R$','Lancamentos','Status custo diferente']];
    for(const x of selectedRows())rows.push([x.date,x.empresa,x.codigoLocal,x.local,x.grupo,x.codigo,x.produto,x.un,x.quantity,x.cents/100,x.count,x.diff]);
    const encode=v=>{let t=String(v??'');if(/^[=+\-@\t\r]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"'};
    const blob=new Blob(['\ufeff'+rows.map(r=>r.map(encode).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='baixas_ERP_'+$('#erp-h-year').value+'.csv';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  window.DB_HISTORICO_BAIXAS={open:()=>{panel.open=true;openYear()},getMeta:()=>meta,yearLoaded:y=>rowsByYear.has(String(y))};
    return true;
  }
  // The fast dashboard creates its views after scripts have been evaluated.
  // Wait until the Baixas container exists; avoid silently skipping this tab.
  if(!setup()){
    document.addEventListener('DOMContentLoaded',setup,{once:true});
    window.addEventListener('load',setup,{once:true});
    window.addEventListener('stock-position-updated',setup);
    window.addEventListener('movements-updated',setup);
  }
})();