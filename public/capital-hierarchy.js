// Drilldown do capital em estoque: Local -> Grupo -> Produto
(function(){
  if(document.documentElement.dataset.capitalHierarchy==='1')return;
  document.documentElement.dataset.capitalHierarchy='1';

  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const br=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const n1=v=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:1}).format(Number(v)||0);
  const pct=v=>new Intl.NumberFormat('pt-BR',{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1}).format(Number(v)||0);

  const style=document.createElement('style');
  style.textContent=`
    #view-executivo .capital-hierarchy .board-title{gap:12px}
    #view-executivo .capital-hierarchy .capital-title-left{display:flex;align-items:center;gap:10px;min-width:0;flex-wrap:wrap}
    #view-executivo .capital-hierarchy .capital-breadcrumb{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
    #view-executivo .capital-hierarchy .capital-crumb{border:0;background:transparent;color:var(--db-green-dark,#125c31);font-size:9px;font-weight:900;padding:3px 4px;border-radius:6px;cursor:pointer}
    #view-executivo .capital-hierarchy .capital-crumb:hover{background:var(--db-green-soft,#e6f3eb)}
    #view-executivo .capital-hierarchy .capital-crumb.current{color:#66736b;cursor:default;background:transparent}
    #view-executivo .capital-hierarchy .capital-sep{color:#9aa59e;font-size:10px;font-weight:900}
    #view-executivo .capital-hierarchy .capital-level{font-size:9px;color:#6d786f;white-space:nowrap}
    #view-executivo .capital-hierarchy tbody tr{cursor:pointer}
    #view-executivo .capital-hierarchy tbody tr td:first-child:before{content:'›';display:inline-block;margin-right:7px;color:var(--db-green,#1e8747);font-weight:900;font-size:13px}
    #view-executivo .capital-hierarchy tbody tr.capital-product-row td:first-child:before{content:'';margin-right:0}
    #view-executivo .capital-hierarchy .capital-product-row{cursor:default}
    #view-executivo .capital-hierarchy .capital-open-product{border:1px solid #cfe0d5;background:#fff;color:var(--db-green-dark,#125c31);border-radius:7px;padding:4px 7px;font-size:8.5px;font-weight:900;cursor:pointer;white-space:nowrap}
    #view-executivo .capital-hierarchy .capital-open-product:hover{background:var(--db-yellow-soft,#fff6c7);border-color:#efd76b}
    #view-executivo .capital-hierarchy .capital-summary{font-size:9px;color:#6b776f}
  `;
  document.head.appendChild(style);

  function fire(el){if(!el)return;el.dispatchEvent(new Event(el.tagName==='INPUT'?'input':'change',{bubbles:true}))}
  function setFilter(id,value){const el=document.getElementById(id);if(!el)return;let v=String(value??'');if(el.tagName==='SELECT'){
    const nv=norm(v),opt=[...el.options].find(o=>norm(o.value)===nv||norm(o.textContent)===nv);if(opt)v=opt.value;
  }el.value=v;fire(el)}
  function openStock(local,group,code){
    for(const id of ['fEmpresa','fLocal','fGrupo','fUn','fFornecedor','fBusca']){const el=document.getElementById(id);if(el&&el.value){el.value='';fire(el)}}
    setFilter('fLocal',local);setFilter('fGrupo',group);setFilter('fBusca',code);
    const tab=document.querySelector('.tab[data-view="estoque"]');if(tab)tab.click();
    setTimeout(()=>{setFilter('fLocal',local);setFilter('fGrupo',group);setFilter('fBusca',code);window.scrollTo({top:0,behavior:'smooth'})},60);
  }

  function install(){
    const view=document.getElementById('view-executivo');
    if(!view||typeof STOCK==='undefined'||!Array.isArray(STOCK)||!STOCK.length)return false;
    const panel=[...view.querySelectorAll('.board-panel')].find(p=>norm(p.querySelector('.board-title h3')?.textContent)==='ONDE ESTA O CAPITAL EM ESTOQUE');
    if(!panel)return false;
    if(panel.dataset.capitalHierarchy==='1')return true;
    panel.dataset.capitalHierarchy='1';panel.classList.add('capital-hierarchy');

    // Substitui o cabecalho para remover o clique antigo que enviava direto para Estoque.
    const oldHead=panel.querySelector('.board-title');
    const head=document.createElement('div');head.className='board-title';
    head.innerHTML='<div class="capital-title-left"><h3>Onde está o capital em estoque</h3><div class="capital-breadcrumb"></div></div><span class="capital-level"></span>';
    if(oldHead)oldHead.replaceWith(head);else panel.insertBefore(head,panel.firstChild);

    const table=panel.querySelector('table');if(!table)return false;
    const total=STOCK.reduce((a,x)=>a+(Number(x.valor_estoque)||0),0);
    let level='local',selectedLocal='',selectedGroup='',currentRows=[];

    const byLocal=()=>{
      const m=new Map();
      for(const x of STOCK){const k=String(x.local||'SEM LOCAL');const a=m.get(k)||{local:k,valor:0,produtos:new Set(),grupos:new Set()};a.valor+=Number(x.valor_estoque)||0;a.produtos.add(String(x.codigo));a.grupos.add(String(x.grupo||'SEM GRUPO'));m.set(k,a)}
      return [...m.values()].sort((a,b)=>b.valor-a.valor);
    };
    const byGroup=local=>{
      const m=new Map();
      for(const x of STOCK){if(String(x.local)!==local)continue;const k=String(x.grupo||'SEM GRUPO');const a=m.get(k)||{grupo:k,valor:0,produtos:new Set()};a.valor+=Number(x.valor_estoque)||0;a.produtos.add(String(x.codigo));m.set(k,a)}
      return [...m.values()].sort((a,b)=>b.valor-a.valor);
    };
    const byProduct=(local,group)=>STOCK.filter(x=>String(x.local)===local&&String(x.grupo||'SEM GRUPO')===group).sort((a,b)=>(Number(b.valor_estoque)||0)-(Number(a.valor_estoque)||0));

    function breadcrumb(){
      const bc=head.querySelector('.capital-breadcrumb'),label=head.querySelector('.capital-level');
      const parts=[];
      parts.push(`<button type="button" class="capital-crumb ${level==='local'?'current':''}" data-level="local">Local</button>`);
      if(selectedLocal){parts.push('<span class="capital-sep">›</span>');parts.push(`<button type="button" class="capital-crumb ${level==='group'?'current':''}" data-level="group">${esc(selectedLocal)}</button>`)}
      if(selectedGroup){parts.push('<span class="capital-sep">›</span>');parts.push(`<button type="button" class="capital-crumb current" data-level="product">${esc(selectedGroup)}</button>`)}
      bc.innerHTML=parts.join('');
      label.textContent=level==='local'?'1. Local':level==='group'?'2. Grupo':'3. Produto';
    }

    function renderLocal(){
      level='local';selectedLocal='';selectedGroup='';breadcrumb();currentRows=byLocal();
      table.innerHTML=`<thead><tr><th>Local</th><th class="num">Grupos</th><th class="num">Produtos</th><th class="num">Capital</th><th class="num">Participação</th></tr></thead><tbody>${currentRows.map((x,i)=>`<tr data-index="${i}"><td><b>${esc(x.local)}</b></td><td class="num">${x.grupos.size}</td><td class="num">${x.produtos.size}</td><td class="num"><b>${br(x.valor)}</b></td><td class="num">${pct(total?x.valor/total:0)}</td></tr>`).join('')}</tbody>`;
    }
    function renderGroup(local){
      level='group';selectedLocal=local;selectedGroup='';breadcrumb();currentRows=byGroup(local);const subtotal=currentRows.reduce((a,x)=>a+x.valor,0);
      table.innerHTML=`<thead><tr><th>Grupo</th><th class="num">Produtos</th><th class="num">Capital</th><th class="num">Participação no local</th></tr></thead><tbody>${currentRows.map((x,i)=>`<tr data-index="${i}"><td><b>${esc(x.grupo)}</b></td><td class="num">${x.produtos.size}</td><td class="num"><b>${br(x.valor)}</b></td><td class="num">${pct(subtotal?x.valor/subtotal:0)}</td></tr>`).join('')}</tbody>`;
    }
    function renderProduct(local,group){
      level='product';selectedLocal=local;selectedGroup=group;breadcrumb();currentRows=byProduct(local,group);const subtotal=currentRows.reduce((a,x)=>a+(Number(x.valor_estoque)||0),0);
      table.innerHTML=`<thead><tr><th>Código / Produto</th><th>UN</th><th class="num">Estoque</th><th class="num">Custo médio</th><th class="num">Capital</th><th class="num">% grupo</th><th></th></tr></thead><tbody>${currentRows.map((x,i)=>`<tr class="capital-product-row" data-index="${i}"><td><b>${esc(x.codigo)}</b> - ${esc(x.produto)}</td><td>${esc(x.un||'')}</td><td class="num">${n1(x.estoque)} ${esc(x.un||'')}</td><td class="num">${br(x.custo_estoque)}</td><td class="num"><b>${br(x.valor_estoque)}</b></td><td class="num">${pct(subtotal?(Number(x.valor_estoque)||0)/subtotal:0)}</td><td class="num"><button type="button" class="capital-open-product" data-open="${i}">Abrir item</button></td></tr>`).join('')}</tbody>`;
    }

    head.addEventListener('click',e=>{
      const b=e.target.closest('.capital-crumb');if(!b)return;e.preventDefault();e.stopPropagation();
      if(b.dataset.level==='local')renderLocal();else if(b.dataset.level==='group'&&selectedLocal)renderGroup(selectedLocal);
    });
    table.addEventListener('click',e=>{
      const open=e.target.closest('[data-open]');if(open){const x=currentRows[Number(open.dataset.open)];if(x)openStock(selectedLocal,selectedGroup,String(x.codigo));return}
      const tr=e.target.closest('tbody tr[data-index]');if(!tr)return;const x=currentRows[Number(tr.dataset.index)];if(!x)return;
      if(level==='local')renderGroup(x.local);else if(level==='group')renderProduct(selectedLocal,x.grupo);
    });

    renderLocal();
    return true;
  }

  if(!install()){
    let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>50)clearInterval(timer)},100);
  }
})();
