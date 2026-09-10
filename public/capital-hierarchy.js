// Grafico de colunas do capital em estoque: Local -> Grupo -> Produto
(function(){
  if(document.documentElement.dataset.capitalHierarchy==='2')return;
  document.documentElement.dataset.capitalHierarchy='2';

  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const br=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const brCompact=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',notation:'compact',maximumFractionDigits:1}).format(Number(v)||0);
  const n1=v=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:1}).format(Number(v)||0);

  const style=document.createElement('style');
  style.textContent=`
    #view-executivo .capital-hierarchy .board-title{gap:12px;align-items:flex-start}
    #view-executivo .capital-hierarchy .capital-title-left{display:flex;align-items:center;gap:10px;min-width:0;flex-wrap:wrap}
    #view-executivo .capital-hierarchy .capital-breadcrumb{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
    #view-executivo .capital-hierarchy .capital-crumb{border:0;background:transparent;color:var(--db-green-dark,#125c31);font-size:9px;font-weight:900;padding:3px 4px;border-radius:6px;cursor:pointer}
    #view-executivo .capital-hierarchy .capital-crumb:hover{background:var(--db-green-soft,#e6f3eb)}
    #view-executivo .capital-hierarchy .capital-crumb.current{color:#66736b;cursor:default;background:transparent}
    #view-executivo .capital-hierarchy .capital-sep{color:#9aa59e;font-size:10px;font-weight:900}
    #view-executivo .capital-hierarchy .capital-level{text-align:right;font-size:9px;color:#6d786f;white-space:nowrap;line-height:1.45}
    #view-executivo .capital-hierarchy .capital-chart-shell{padding:10px 10px 12px;background:#fff}
    #view-executivo .capital-hierarchy .capital-chart-summary{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:0 4px 9px;font-size:9px;color:#6a766e}
    #view-executivo .capital-hierarchy .capital-chart-summary b{color:var(--db-green-deep,#0d4726);font-size:10px}
    #view-executivo .capital-hierarchy .capital-chart{display:grid;grid-template-columns:62px minmax(0,1fr);gap:5px;align-items:start}
    #view-executivo .capital-hierarchy .capital-yaxis{height:220px;position:relative;border-right:1px solid #dbe7df;margin-top:1px}
    #view-executivo .capital-hierarchy .capital-ylabel{position:absolute;right:7px;transform:translateY(-50%);font-size:7.5px;font-weight:800;color:#7a857e;white-space:nowrap}
    #view-executivo .capital-hierarchy .capital-ylabel.y0{top:0;transform:none}
    #view-executivo .capital-hierarchy .capital-ylabel.y25{top:25%}
    #view-executivo .capital-hierarchy .capital-ylabel.y50{top:50%}
    #view-executivo .capital-hierarchy .capital-ylabel.y75{top:75%}
    #view-executivo .capital-hierarchy .capital-ylabel.y100{top:100%;transform:translateY(-100%)}
    #view-executivo .capital-hierarchy .capital-chart-scroll{overflow-x:auto;overflow-y:hidden;padding-bottom:5px;scrollbar-width:thin;scrollbar-color:#b8c9bd #f1f5f2}
    #view-executivo .capital-hierarchy .capital-bars{display:flex;gap:10px;align-items:stretch;width:max-content;min-width:100%;padding:0 8px 0 4px}
    #view-executivo .capital-hierarchy .capital-column{width:92px;min-width:92px;border:0;background:transparent;padding:0;display:grid;grid-template-rows:220px 58px;cursor:pointer;text-align:center;font-family:inherit;color:inherit}
    #view-executivo .capital-hierarchy .capital-column.product{width:104px;min-width:104px}
    #view-executivo .capital-hierarchy .capital-plotcell{height:220px;position:relative;border-bottom:1px solid #cfded4;background:linear-gradient(to bottom,transparent 24.6%,#edf3ef 25%,transparent 25.4%,transparent 49.6%,#edf3ef 50%,transparent 50.4%,transparent 74.6%,#edf3ef 75%,transparent 75.4%)}
    #view-executivo .capital-hierarchy .capital-bar{position:absolute;left:18%;right:18%;bottom:0;height:var(--bar-h);min-height:3px;border-radius:7px 7px 2px 2px;background:linear-gradient(180deg,var(--db-green,#1e8747),var(--db-green-dark,#125c31));box-shadow:0 3px 10px rgba(30,135,71,.16);transition:filter .15s ease,transform .15s ease,height .25s ease}
    #view-executivo .capital-hierarchy .capital-bar:after{content:'';position:absolute;left:0;right:0;top:0;height:4px;border-radius:7px 7px 0 0;background:var(--db-yellow,#faca04)}
    #view-executivo .capital-hierarchy .capital-bar-value{position:absolute;left:50%;bottom:calc(var(--bar-h) + 5px);transform:translateX(-50%);font-size:7.5px;font-weight:900;color:var(--db-green-deep,#0d4726);white-space:nowrap}
    #view-executivo .capital-hierarchy .capital-column:hover .capital-bar,#view-executivo .capital-hierarchy .capital-column:focus-visible .capital-bar{filter:brightness(1.08);transform:translateY(-2px)}
    #view-executivo .capital-hierarchy .capital-column:focus-visible{outline:2px solid var(--db-yellow,#faca04);outline-offset:2px;border-radius:8px}
    #view-executivo .capital-hierarchy .capital-xlabel{padding:7px 2px 0;font-size:8px;font-weight:850;line-height:1.22;color:#44524a;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-word}
    #view-executivo .capital-hierarchy .capital-xsub{display:block;margin-top:3px;font-size:7px;font-weight:700;color:#879189}
    #view-executivo .capital-hierarchy .capital-empty{padding:35px 15px;text-align:center;font-size:10px;color:#748078}
    #view-executivo .capital-hierarchy .capital-open-hint{font-size:8px;color:var(--db-green-dark,#125c31);font-weight:800}
    @media(max-width:760px){#view-executivo .capital-hierarchy .capital-chart{grid-template-columns:48px minmax(0,1fr)}#view-executivo .capital-hierarchy .capital-column{width:78px;min-width:78px}#view-executivo .capital-hierarchy .capital-column.product{width:88px;min-width:88px}#view-executivo .capital-hierarchy .capital-ylabel{font-size:6.5px}}
  `;
  document.head.appendChild(style);

  function fire(el){if(!el)return;el.dispatchEvent(new Event(el.tagName==='INPUT'?'input':'change',{bubbles:true}))}
  function setFilter(id,value){
    const el=document.getElementById(id);if(!el)return;
    let v=String(value??'');
    if(el.tagName==='SELECT'){
      const nv=norm(v),opt=[...el.options].find(o=>norm(o.value)===nv||norm(o.textContent)===nv);
      if(opt)v=opt.value;
    }
    el.value=v;fire(el);
  }
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
    if(panel.dataset.capitalHierarchy==='2')return true;
    panel.dataset.capitalHierarchy='2';panel.classList.add('capital-hierarchy');

    const oldHead=panel.querySelector('.board-title');
    const head=document.createElement('div');head.className='board-title';
    head.innerHTML='<div class="capital-title-left"><h3>Onde está o capital em estoque</h3><div class="capital-breadcrumb"></div></div><span class="capital-level"></span>';
    if(oldHead)oldHead.replaceWith(head);else panel.insertBefore(head,panel.firstChild);

    const oldTable=panel.querySelector('table');
    const shell=document.createElement('div');shell.className='capital-chart-shell';
    if(oldTable)oldTable.replaceWith(shell);else panel.appendChild(shell);

    const total=STOCK.reduce((a,x)=>a+(Number(x.valor_estoque)||0),0);
    let level='local',selectedLocal='',selectedGroup='',currentRows=[];

    const byLocal=()=>{
      const m=new Map();
      for(const x of STOCK){
        const k=String(x.local||'SEM LOCAL'),a=m.get(k)||{local:k,valor:0,produtos:new Set(),grupos:new Set()};
        a.valor+=Number(x.valor_estoque)||0;a.produtos.add(String(x.codigo));a.grupos.add(String(x.grupo||'SEM GRUPO'));m.set(k,a);
      }
      return [...m.values()].sort((a,b)=>b.valor-a.valor);
    };
    const byGroup=local=>{
      const m=new Map();
      for(const x of STOCK){
        if(String(x.local)!==local)continue;
        const k=String(x.grupo||'SEM GRUPO'),a=m.get(k)||{grupo:k,valor:0,produtos:new Set()};
        a.valor+=Number(x.valor_estoque)||0;a.produtos.add(String(x.codigo));m.set(k,a);
      }
      return [...m.values()].sort((a,b)=>b.valor-a.valor);
    };
    const byProduct=(local,group)=>{
      const m=new Map();
      for(const x of STOCK){
        if(String(x.local)!==local||String(x.grupo||'SEM GRUPO')!==group)continue;
        const k=String(x.codigo),a=m.get(k)||{codigo:x.codigo,produto:x.produto,un:x.un,estoque:0,valor:0};
        a.estoque+=Number(x.estoque)||0;a.valor+=Number(x.valor_estoque)||0;m.set(k,a);
      }
      return [...m.values()].map(x=>({...x,custo:x.estoque?x.valor/x.estoque:0})).sort((a,b)=>b.valor-a.valor);
    };

    function breadcrumb(){
      const bc=head.querySelector('.capital-breadcrumb'),label=head.querySelector('.capital-level');
      const parts=[];
      parts.push(`<button type="button" class="capital-crumb ${level==='local'?'current':''}" data-level="local">Local</button>`);
      if(selectedLocal){parts.push('<span class="capital-sep">›</span>');parts.push(`<button type="button" class="capital-crumb ${level==='group'?'current':''}" data-level="group">${esc(selectedLocal)}</button>`)}
      if(selectedGroup){parts.push('<span class="capital-sep">›</span>');parts.push(`<button type="button" class="capital-crumb current" data-level="product">${esc(selectedGroup)}</button>`)}
      bc.innerHTML=parts.join('');
      label.innerHTML=(level==='local'?'1. Local':level==='group'?'2. Grupo':'3. Produto')+'<br><span class="capital-open-hint">Clique nas colunas</span>';
    }

    function chartHtml(rows,opts={}){
      if(!rows.length)return '<div class="capital-empty">Nenhum valor de estoque encontrado neste nível.</div>';
      const values=rows.map(opts.value).map(v=>Math.max(Number(v)||0,0));
      const max=Math.max(...values,1),subtotal=values.reduce((a,v)=>a+v,0);
      const y=[max,max*.75,max*.5,max*.25,0];
      const bars=rows.map((x,i)=>{
        const value=values[i],h=value>0?Math.max(2,Math.min(100,value/max*100)):0;
        const label=opts.label(x),sub=opts.sub?opts.sub(x):'';
        return `<button type="button" class="capital-column ${opts.product?'product':''}" data-index="${i}" title="${esc(label)} • ${esc(br(value))}"><span class="capital-plotcell" style="--bar-h:${h.toFixed(2)}%"><span class="capital-bar-value">${esc(brCompact(value))}</span><span class="capital-bar"></span></span><span class="capital-xlabel">${esc(label)}${sub?`<span class="capital-xsub">${esc(sub)}</span>`:''}</span></button>`;
      }).join('');
      return `<div class="capital-chart-summary"><span>${esc(opts.summary||'')}</span><b>${br(subtotal)}</b></div><div class="capital-chart"><div class="capital-yaxis"><span class="capital-ylabel y0">${esc(brCompact(y[0]))}</span><span class="capital-ylabel y25">${esc(brCompact(y[1]))}</span><span class="capital-ylabel y50">${esc(brCompact(y[2]))}</span><span class="capital-ylabel y75">${esc(brCompact(y[3]))}</span><span class="capital-ylabel y100">R$ 0</span></div><div class="capital-chart-scroll"><div class="capital-bars">${bars}</div></div></div>`;
    }

    function renderLocal(){
      level='local';selectedLocal='';selectedGroup='';currentRows=byLocal();breadcrumb();
      shell.innerHTML=chartHtml(currentRows,{value:x=>x.valor,label:x=>x.local,sub:x=>`${x.grupos.size} grupos • ${x.produtos.size} produtos`,summary:`Capital por local • ${currentRows.length} locais`});
    }
    function renderGroup(local){
      level='group';selectedLocal=local;selectedGroup='';currentRows=byGroup(local);breadcrumb();
      shell.innerHTML=chartHtml(currentRows,{value:x=>x.valor,label:x=>x.grupo,sub:x=>`${x.produtos.size} produtos`,summary:`Capital por grupo • ${local}`});
    }
    function renderProduct(local,group){
      level='product';selectedLocal=local;selectedGroup=group;currentRows=byProduct(local,group);breadcrumb();
      shell.innerHTML=chartHtml(currentRows,{product:true,value:x=>x.valor,label:x=>`${x.codigo} - ${x.produto}`,sub:x=>`${n1(x.estoque)} ${x.un||''} • ${br(x.custo)}/un`,summary:`Capital por produto • ${group}`});
    }

    head.addEventListener('click',e=>{
      const b=e.target.closest('.capital-crumb');if(!b)return;e.preventDefault();e.stopPropagation();
      if(b.dataset.level==='local')renderLocal();else if(b.dataset.level==='group'&&selectedLocal)renderGroup(selectedLocal);
    });
    shell.addEventListener('click',e=>{
      const col=e.target.closest('.capital-column[data-index]');if(!col)return;
      const x=currentRows[Number(col.dataset.index)];if(!x)return;
      if(level==='local')renderGroup(x.local);
      else if(level==='group')renderProduct(selectedLocal,x.grupo);
      else if(level==='product')openStock(selectedLocal,selectedGroup,String(x.codigo));
    });

    renderLocal();
    return true;
  }

  if(!install()){
    let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>50)clearInterval(timer)},100);
  }
})();
