// Interatividade do Resumo Executivo - 09/09/2026
(function(){
  const view=document.getElementById('view-executivo');
  if(!view || document.documentElement.dataset.executiveInteractive==='1') return;
  document.documentElement.dataset.executiveInteractive='1';
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const br=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const n1=v=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:1}).format(Number(v)||0);
  const excluded=x=>typeof window.EXECUTIVE_PRODUCT_EXCLUDED==='function'?window.EXECUTIVE_PRODUCT_EXCLUDED(x):false;

  const style=document.createElement('style');
  style.textContent=`
    #view-executivo .board-kpi.exec-clickable,#view-executivo .board-panel.exec-clickable-title .board-title,#view-executivo .board-panel tbody tr.exec-clickable,#view-executivo .board-reading>div.exec-clickable{cursor:pointer;transition:transform .13s ease,box-shadow .13s ease,background .13s ease}
    #view-executivo .board-kpi.exec-clickable:hover,#view-executivo .board-reading>div.exec-clickable:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(23,54,93,.10);border-color:#bdcddd}
    #view-executivo .board-panel tbody tr.exec-clickable:hover{background:#eef5fb}
    #view-executivo .board-panel.exec-clickable-title .board-title:hover{background:#f7fafc}
    #view-executivo .exec-clickable{position:relative}
    #view-executivo .board-kpi.exec-clickable:after,#view-executivo .board-reading>div.exec-clickable:after{content:'Clique para detalhar';display:block;margin-top:7px;font-size:8px;font-weight:800;color:#52799a;opacity:.78}
    #view-executivo .board-panel tbody tr.exec-clickable td:first-child:before{content:'›';display:inline-block;margin-right:6px;color:#6685a0;font-weight:900}
    .exec-drill-backdrop{position:fixed;inset:0;background:rgba(20,31,45,.28);z-index:998;opacity:0;pointer-events:none;transition:opacity .18s ease}
    .exec-drill-backdrop.open{opacity:1;pointer-events:auto}
    .exec-drill-drawer{position:fixed;right:0;top:0;bottom:0;width:min(760px,92vw);z-index:999;background:#fff;box-shadow:-18px 0 42px rgba(22,43,67,.18);transform:translateX(102%);transition:transform .22s ease;display:flex;flex-direction:column}
    .exec-drill-drawer.open{transform:translateX(0)}
    .exec-drill-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:18px 20px;border-bottom:1px solid #e2e8ef}
    .exec-drill-head h3{margin:0 0 4px;font-size:17px;color:#17365d}.exec-drill-head p{margin:0;font-size:10px;line-height:1.45;color:#6b7787}
    .exec-drill-close{border:1px solid #d8e1ea;background:#fff;border-radius:9px;padding:7px 10px;font-weight:850;color:#17365d;cursor:pointer}
    .exec-drill-body{overflow:auto;padding:14px 18px 28px}.exec-drill-body table{width:100%;border-collapse:collapse;font-size:10px}.exec-drill-body th{position:sticky;top:0;background:#eef3f8;color:#17365d;text-align:left;padding:8px;border-bottom:1px solid #d8e2ec}.exec-drill-body td{padding:8px;border-bottom:1px solid #edf1f5}.exec-drill-body tr[data-go]{cursor:pointer}.exec-drill-body tr[data-go]:hover{background:#f4f8fb}.exec-drill-body .num{text-align:right;white-space:nowrap}
    .exec-drill-note{padding:9px 11px;margin-bottom:12px;background:#f5f8fb;border:1px solid #e0e7ef;border-radius:10px;font-size:9.5px;line-height:1.45;color:#5d6b7b}
    .exec-drill-toast{position:fixed;left:50%;bottom:24px;z-index:1001;transform:translate(-50%,14px);opacity:0;pointer-events:none;background:#17365d;color:#fff;padding:8px 12px;border-radius:9px;font-size:10px;font-weight:800;transition:.18s}.exec-drill-toast.show{opacity:1;transform:translate(-50%,0)}
  `;
  document.head.appendChild(style);

  const backdrop=document.createElement('div');backdrop.className='exec-drill-backdrop';
  const drawer=document.createElement('aside');drawer.className='exec-drill-drawer';drawer.innerHTML='<div class="exec-drill-head"><div><h3></h3><p></p></div><button type="button" class="exec-drill-close">Fechar</button></div><div class="exec-drill-body"></div>';
  const toast=document.createElement('div');toast.className='exec-drill-toast';
  document.body.append(backdrop,drawer,toast);
  const closeDrawer=()=>{backdrop.classList.remove('open');drawer.classList.remove('open')};
  backdrop.addEventListener('click',closeDrawer);drawer.querySelector('.exec-drill-close').addEventListener('click',closeDrawer);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDrawer()});
  function openDrawer(title,subtitle,html){drawer.querySelector('h3').textContent=title;drawer.querySelector('.exec-drill-head p').textContent=subtitle||'';drawer.querySelector('.exec-drill-body').innerHTML=html;backdrop.classList.add('open');drawer.classList.add('open')}
  function showToast(text){toast.textContent=text;toast.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.remove('show'),1800)}
  function fire(el){if(!el)return;el.dispatchEvent(new Event(el.tagName==='INPUT'?'input':'change',{bubbles:true}))}
  function setSelectOrInput(id,value){const el=document.getElementById(id);if(!el)return false;let v=String(value??'');if(el.tagName==='SELECT'){
      const nv=norm(v),opt=[...el.options].find(o=>norm(o.value)===nv||norm(o.textContent)===nv||norm(o.textContent).includes(nv)||nv.includes(norm(o.textContent)));
      if(opt)v=opt.value;
    }
    el.value=v;fire(el);return true;
  }
  function clickTab(name){const tab=document.querySelector(`.tab[data-view="${name}"]`);if(tab){tab.click();return true}return false}
  function go(name,filters={},after){closeDrawer();
    // Limpa somente filtros que receberão novo contexto, preservando os demais filtros escolhidos pelo usuário.
    for(const [id,val] of Object.entries(filters))setSelectOrInput(id,val);
    clickTab(name);
    setTimeout(()=>{for(const [id,val] of Object.entries(filters))setSelectOrInput(id,val);if(after)after();window.scrollTo({top:0,behavior:'smooth'});},50);
  }
  function clearTargetFilters(ids){for(const id of ids){const el=document.getElementById(id);if(el&&el.value){el.value='';fire(el)}}}
  function goExact(name,filters={},after){clearTargetFilters(['fEmpresa','fLocal','fGrupo','fUn','fFornecedor','fBusca']);go(name,filters,after)}

  function deadRows(){
    if(typeof STOCK==='undefined'||typeof MOVEMENTS==='undefined')return[];
    const mm=new Map(MOVEMENTS.map(x=>[String(x.local)+'|'+String(x.codigo),x]));
    return STOCK.filter(x=>!excluded(x)&&!((Number(mm.get(String(x.local)+'|'+String(x.codigo))?.total)||0)>0)).sort((a,b)=>(Number(b.valor_estoque)||0)-(Number(a.valor_estoque)||0));
  }
  function transferRows(){
    let mins=[];try{mins=typeof minimumBaseRows==='function'?minimumBaseRows():MOVEMENTS}catch(e){mins=Array.isArray(MOVEMENTS)?MOVEMENTS:[]}
    mins=mins.filter(x=>!excluded(x));const nb=new Map(),sb=new Map();
    for(const x of mins){const k=String(x.codigo)+'|'+String(x.un||'');if(Number(x.need)>0){if(!nb.has(k))nb.set(k,[]);nb.get(k).push({...x,left:Number(x.need)||0})}if(Number(x.excess)>0){if(!sb.has(k))sb.set(k,[]);sb.get(k).push({...x,left:Number(x.excess)||0})}}
    const out=[];for(const [k,needs] of nb){const srcs=sb.get(k)||[];for(const d of needs.sort((a,b)=>(b.need_value||0)-(a.need_value||0)))for(const o of srcs.sort((a,b)=>(b.excess||0)-(a.excess||0))){if(d.local===o.local||d.left<=0||o.left<=0)continue;const q=Math.min(d.left,o.left);if(q<=0)continue;const cost=Number(d.cost)||Number(o.cost)||0;out.push({codigo:d.codigo,produto:d.produto,grupo:d.grupo,un:d.un,origem:o.local,destino:d.local,qtd:q,valor:q*cost});d.left-=q;o.left-=q}}
    return out.sort((a,b)=>b.valor-a.valor);
  }
  function showDead(){const rows=deadRows(),total=rows.reduce((a,x)=>a+(Number(x.valor_estoque)||0),0);openDrawer('Capital sem giro',`${rows.length} itens no critério • ${br(total)}`,`<div class="exec-drill-note">Óleo, lubrificantes, pneus e câmaras de ar estão excluídos desta análise. Clique em qualquer linha para abrir o produto no estoque.</div><table><thead><tr><th>Local</th><th>Código / produto</th><th>Grupo</th><th class="num">Valor</th></tr></thead><tbody>${rows.slice(0,80).map(x=>`<tr data-go="stock" data-local="${esc(x.local)}" data-code="${esc(x.codigo)}"><td>${esc(x.local)}</td><td>${esc(x.codigo)} - ${esc(x.produto)}</td><td>${esc(x.grupo)}</td><td class="num">${br(x.valor_estoque)}</td></tr>`).join('')}</tbody></table>`)}
  function showTransfers(){const rows=transferRows(),total=rows.reduce((a,x)=>a+x.valor,0);openDrawer('Transferências antes da compra',`${rows.length} sugestões • ${br(total)}`,`<div class="exec-drill-note">Sugestões calculadas por código e unidade, considerando excesso em um local e necessidade em outro. Clique na linha para abrir o item em Estoque mínimo.</div><table><thead><tr><th>Origem</th><th>Destino</th><th>Produto</th><th class="num">Qtd.</th><th class="num">Valor</th></tr></thead><tbody>${rows.slice(0,100).map(x=>`<tr data-go="minimum" data-local="${esc(x.destino)}" data-code="${esc(x.codigo)}"><td>${esc(x.origem)}</td><td>${esc(x.destino)}</td><td>${esc(x.codigo)} - ${esc(x.produto)}</td><td class="num">${n1(x.qtd)} ${esc(x.un||'')}</td><td class="num">${br(x.valor)}</td></tr>`).join('')}</tbody></table>`)}
  drawer.addEventListener('click',e=>{const tr=e.target.closest('tr[data-go]');if(!tr)return;if(tr.dataset.go==='stock')goExact('estoque',{fLocal:tr.dataset.local,fBusca:tr.dataset.code});if(tr.dataset.go==='minimum')goExact('minimo',{fLocal:tr.dataset.local,fBusca:tr.dataset.code})});

  const kpiMap={
    'VALOR TOTAL EM ESTOQUE':()=>goExact('estoque'),
    'CAPITAL SEM GIRO':showDead,
    'NECESSIDADE BRUTA DE REPOSICAO':()=>goExact('minimo'),
    'TRANSFERIR ANTES DE COMPRAR':showTransfers,
    'COMPRA ESTIMADA APOS TRANSFERENCIAS':()=>goExact('minimo'),
    'ITENS CRITICOS DE ABASTECIMENTO':()=>goExact('minimo'),
    'COMPRAS DESDE 01/08/2026':()=>goExact('historico'),
    'POTENCIAL AMPLO DE ECONOMIA':()=>goExact('economia')
  };
  function bindKpis(){for(const c of view.querySelectorAll('.board-kpi')){const key=norm(c.querySelector('.label')?.textContent);const fn=kpiMap[key];if(!fn||c.dataset.execBound)return;c.dataset.execBound='1';c.classList.add('exec-clickable');c.tabIndex=0;c.setAttribute('role','button');c.title='Clique para detalhar';c.addEventListener('click',fn);c.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn()}})}}
  function bindReadings(){for(const r of view.querySelectorAll('.board-reading>div')){if(r.dataset.execBound)continue;const key=norm(r.querySelector('b')?.textContent);let fn=null;if(key==='CAPITAL')fn=showDead;else if(key==='ABASTECIMENTO')fn=()=>goExact('minimo');else if(key==='COMPRAS')fn=()=>goExact('economia');if(!fn)continue;r.dataset.execBound='1';r.classList.add('exec-clickable');r.tabIndex=0;r.addEventListener('click',fn);r.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn()}})}}
  function bindPanels(){
    for(const p of view.querySelectorAll('.board-panel')){
      const title=p.querySelector('.board-title h3')?.textContent.trim()||'';const nt=norm(title);const head=p.querySelector('.board-title');
      if(head&&!head.dataset.execBound){let fn=null;if(nt==='ONDE ESTA O CAPITAL EM ESTOQUE')fn=()=>goExact('estoque');else if(nt==='MAIORES NECESSIDADES DE REPOSICAO')fn=()=>goExact('minimo');else if(nt==='MAIOR CAPITAL SEM GIRO')fn=showDead;else if(nt==='POTENCIAL DE ECONOMIA POR GRUPO')fn=()=>goExact('economia');else if(nt.includes('FORNECEDORES'))fn=()=>goExact('fornecedores');else if(nt==='LEITURA DE COMPRAS')fn=()=>goExact('variacao');if(fn){head.dataset.execBound='1';p.classList.add('exec-clickable-title');head.addEventListener('click',e=>{if(!e.target.closest('tbody'))fn()})}}
      for(const tr of p.querySelectorAll('tbody tr')){if(tr.dataset.execBound)continue;let fn=null;
        if(nt==='ONDE ESTA O CAPITAL EM ESTOQUE'){const local=tr.cells[0]?.textContent.trim();fn=()=>goExact('estoque',{fLocal:local})}
        else if(nt==='MAIORES NECESSIDADES DE REPOSICAO'){const local=tr.cells[0]?.textContent.trim(),code=(tr.cells[1]?.textContent.match(/^\s*(\d+)/)||[])[1];fn=()=>goExact('minimo',{fLocal:local,fBusca:code||''})}
        else if(nt==='MAIOR CAPITAL SEM GIRO'){const local=tr.cells[0]?.textContent.trim(),code=(tr.cells[1]?.textContent.match(/^\s*(\d+)/)||[])[1];fn=()=>goExact('estoque',{fLocal:local,fBusca:code||''})}
        else if(nt==='POTENCIAL DE ECONOMIA POR GRUPO'){const group=tr.cells[0]?.textContent.trim();fn=()=>goExact('economia',{},()=>{const gf=document.getElementById('economyGroupFilter');if(gf){const o=[...gf.options].find(x=>norm(x.value)===norm(group)||norm(x.textContent)===norm(group));if(o){gf.value=o.value;fire(gf)}}})}
        else if(nt.includes('FORNECEDORES')){const supplier=tr.cells[0]?.textContent.trim();fn=()=>goExact('fornecedores',{fFornecedor:supplier})}
        else if(nt==='LEITURA DE COMPRAS'){const label=norm(tr.cells[0]?.textContent);if(label.includes('POTENCIAL AMPLIADO'))fn=()=>goExact('economia');else if(label.includes('COMPRA RECENTE'))fn=()=>goExact('historico');else fn=()=>goExact('variacao')}
        if(fn){tr.dataset.execBound='1';tr.classList.add('exec-clickable');tr.tabIndex=0;tr.title='Clique para abrir o detalhe';tr.addEventListener('click',fn);tr.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn()}})}
      }
    }
  }
  function bind(){bindKpis();bindReadings();bindPanels()}
  bind();setTimeout(bind,100);
  const observer=new MutationObserver(()=>{clearTimeout(observer.t);observer.t=setTimeout(bind,20)});observer.observe(view,{childList:true,subtree:true});
})();
