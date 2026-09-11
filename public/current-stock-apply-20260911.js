// Aplica a posição integral de estoque recebida em 11/09/2026.
(function(){
  const P=window.CURRENT_STOCK_20260911;
  if(!P||!Array.isArray(P.rows)||typeof STOCK==='undefined')return;
  const cols=['empresa','codigo_local','local','codigo','produto','grupo','un','estoque','custo_estoque','valor_estoque'];
  const key=x=>String(x.local)+'|'+String(x.codigo);
  const dk=s=>{const p=String(s||'').split('/');return p.length===3?Number(p[2])*10000+Number(p[1])*100+Number(p[0]):0};
  const oldLoc=new Map((typeof LOCATIONS!=='undefined'?LOCATIONS:[]).map(x=>[String(x.local),x]));

  const hist=new Map();
  if(typeof PURCHASES!=='undefined')for(const x of PURCHASES){
    const k=String(x.codigo)+'|'+String(x.un||'');let h=hist.get(k);
    if(!h){h={rows:[],pos:[],sup:new Set(),q:0,v:0};hist.set(k,h)}
    h.rows.push(x);h.sup.add(x.fornecedor);h.q+=Number(x.qtd)||0;h.v+=Number(x.valor)||0;if(Number(x.preco)>0)h.pos.push(x);
  }
  function hstats(code,un){
    const h=hist.get(String(code)+'|'+String(un||''));if(!h)return null;
    let mn=null,mx=null,lt=null;
    for(const x of h.pos){
      if(!mn||x.preco<mn.preco||(x.preco===mn.preco&&dk(x.data)>dk(mn.data)))mn=x;
      if(!mx||x.preco>mx.preco||(x.preco===mx.preco&&dk(x.data)>dk(mx.data)))mx=x;
      if(!lt||dk(x.data)>=dk(lt.data))lt=x;
    }
    const variation=mn&&mx&&mn.preco>0?(mx.preco-mn.preco)/mn.preco:null;
    let status='SEM HISTÓRICO DE COMPRA';
    if(h.rows.length===1)status='UMA COMPRA';else if(variation!=null)status=variation>.5?'VARIAÇÃO >50%':variation>.2?'VARIAÇÃO >20%':'HISTÓRICO ESTÁVEL';
    return{mn,mx,lt,variation,status,valor:h.v,qtd:h.q,avg:h.q?h.v/h.q:0,fornecedores:h.sup.size,registros:h.rows.length,lista:[...h.sup].filter(Boolean).sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'))};
  }

  const mm=new Map((typeof MOVEMENTS!=='undefined'?MOVEMENTS:[]).map(x=>[String(x.local)+'|'+String(x.codigo),x]));
  const next=[];
  for(const row of P.rows){
    const x={};cols.forEach((c,i)=>x[c]=row[i]);
    const hs=hstats(x.codigo,x.un),m=mm.get(key(x));
    x.min_preco=hs?.mn?.preco||0;x.forn_min=hs?.mn?.fornecedor||'';x.data_min=hs?.mn?.data_min||'';
    x.max_preco=hs?.mx?.preco||0;x.forn_max=hs?.mx?.fornecedor||'';x.data_max=hs?.mx?.data||'';
    x.ultimo_preco=hs?.lt?.preco||0;x.ultimo_forn=hs?.lt?.fornecedor||'';x.data_ultimo=hs?.lt?.data||'';
    x.preco_medio=hs?.avg||0;x.fornecedores=hs?.fornecedores||0;x.registros=hs?.registros||0;x.variacao=hs?.variation??null;
    x.dif_estoque_min=x.min_preco>0?((Number(x.custo_estoque)||0)-x.min_preco)*(Number(x.estoque)||0):0;
    x.status_preco=hs?.status||'SEM HISTÓRICO DE COMPRA';x.fornecedores_lista=hs?.lista||[];
    x.qtd_baixada=Number(m?.total)||0;x.media_mensal=Number(m?.avg)||0;x.cobertura=x.media_mensal>0?(Number(x.estoque)||0)/x.media_mensal:null;
    x.status_consumo=x.qtd_baixada>0?'COM BAIXA NO PERÍODO':(m?'SEM BAIXA NO PERÍODO':'SEM DADOS DE BAIXA');
    next.push(x);
  }
  next.sort((a,b)=>(Number(b.valor_estoque)||0)-(Number(a.valor_estoque)||0)||String(a.local).localeCompare(String(b.local),'pt-BR'));
  STOCK.splice(0,STOCK.length,...next);

  if(typeof PRODUCTS!=='undefined'){
    const pa=new Map();
    for(const x of STOCK){
      const c=String(x.codigo);let a=pa.get(c);if(!a){a={q:0,v:0,loc:new Set(),g:new Map(),u:new Map(),n:new Map()};pa.set(c,a)}
      a.q+=Number(x.estoque)||0;a.v+=Number(x.valor_estoque)||0;a.loc.add(x.local);a.g.set(x.grupo,(a.g.get(x.grupo)||0)+1);a.u.set(x.un,(a.u.get(x.un)||0)+1);a.n.set(x.produto,(a.n.get(x.produto)||0)+1);
    }
    const top=m=>[...m.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'',np=[];
    for(const [c,a] of pa){
      const un=top(a.u),hs=hstats(c,un);const p={codigo:Number(c),produto:top(a.n),grupo:top(a.g),un,estoque:a.q,valor_estoque:a.v,custo_medio_estoque:a.q?a.v/a.q:0,locais:a.loc.size};
      p.min_preco=hs?.mn?.preco||0;p.forn_min=hs?.mn?.fornecedor||'';p.data_min=hs?.mn?.data||'';p.nota_min=hs?.mn?.nota??null;
      p.max_preco=hs?.mx?.preco||0;p.forn_max=hs?.mx?.fornecedor||'';p.data_max=hs?.mx?.data||'';p.nota_max=hs?.mx?.nota??null;
      p.ultimo_preco=hs?.lt?.preco||0;p.ultimo_forn=hs?.lt?.fornecedor||'';p.data_ultimo=hs?.lt?.data||'';p.nota_ultimo=hs?.lt?.nota??null;
      p.preco_medio=hs?.avg||0;p.fornecedores=hs?.fornecedores||0;p.registros=hs?.registros||0;p.variacao=hs?.variation??null;p.fornecedores_lista=hs?.lista||[];p.valor_comprado=hs?.valor||0;p.qtd_comprada=hs?.qtd||0;p.status=hs?.status||'SEM HISTÓRICO DE COMPRA';np.push(p);
    }
    np.sort((a,b)=>(Number(b.valor_estoque)||0)-(Number(a.valor_estoque)||0));PRODUCTS.splice(0,PRODUCTS.length,...np);
  }

  if(typeof MOVEMENTS!=='undefined'){
    const sm=new Map();for(const x of STOCK){const k=key(x),y=sm.get(k)||{stock:0,value:0,cost:0};y.stock+=Number(x.estoque)||0;y.value+=Number(x.valor_estoque)||0;y.cost=y.stock?y.value/y.stock:(Number(x.custo_estoque)||y.cost);sm.set(k,y)}
    for(const x of MOVEMENTS){
      const y=sm.get(String(x.local)+'|'+String(x.codigo)),stock=y?y.stock:0,cost=y&&y.cost>0?y.cost:(Number(x.cost)||0),avg=Number(x.avg)||0,minimum=Number(x.minimum)||0,total=Number(x.total)||0;
      const continuous=typeof MINIMUM_CONTINUOUS_UNITS!=='undefined'&&MINIMUM_CONTINUOUS_UNITS.has(String(x.un||'').toUpperCase()),raw=Math.max(minimum-stock,0),need=continuous?Math.ceil((raw-1e-10)*100)/100:Math.ceil(raw-1e-10);
      x.stock=stock;x.cost=cost;x.stock_value=stock*cost;x.coverage=avg>0?stock/avg:null;x.need=need;x.need_value=need*cost;x.excess=Math.max(stock-minimum,0);
      if(!(total>0))x.status='SEM DADOS DE BAIXA';else if(!(avg>0))x.status='HISTÓRICO PARCIAL';else if(stock<=0)x.status='SEM ESTOQUE';else if(stock<minimum-1e-9)x.status='ABAIXO DO MÍNIMO';else if(stock<minimum*1.25-1e-9)x.status='ATENÇÃO';else x.status='OK';
      if('consumption_value'in x)x.consumption_value=total*cost;
    }
  }

  if(typeof LOCATIONS!=='undefined'){
    const la=new Map();for(const x of STOCK){let a=la.get(x.local);if(!a){a={valor:0,pos:0,codes:new Set(),hist:0,dif:0,empresa:x.empresa};la.set(x.local,a)}a.valor+=Number(x.valor_estoque)||0;a.pos++;a.codes.add(String(x.codigo));if((Number(x.registros)||0)>0)a.hist++;a.dif+=Number(x.dif_estoque_min)||0}
    const nl=[];for(const [loc,a] of la){const o=oldLoc.get(loc)||{};nl.push({...o,local:loc,empresa:a.empresa,tem_estoque:true,valor_estoque:a.valor,posicoes:a.pos,produtos_estoque:a.codes.size,com_hist:a.hist,sem_hist:a.pos-a.hist,dif:a.dif,valor_comprado:o.valor_comprado||0,linhas:o.linhas||0,produtos_comprados:o.produtos_comprados||0,fornecedores:o.fornecedores||0,ultima:o.ultima||''})}
    nl.sort((a,b)=>b.valor_estoque-a.valor_estoque);LOCATIONS.splice(0,LOCATIONS.length,...nl);
  }

  document.querySelectorAll('header p').forEach(el=>{el.innerHTML=el.innerHTML.replace(/Última atualização do dashboard:\s*\d{2}\/\d{2}\/\d{4}/i,'Última atualização do dashboard: 11/09/2026').replace(/posição de estoque:\s*\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2})?/i,'posição de estoque: 11/09/2026')});
  try{render()}catch(e){console.error('Falha ao renderizar posição de estoque 11/09/2026',e)}

  const br=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0),n0=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(Number(v)||0);
  function setExec(label,val){for(const el of document.querySelectorAll('.exec-kpi'))if(el.querySelector('.k')?.textContent.trim()===label){const v=el.querySelector('.v');if(v)v.textContent=val;break}}
  const total=STOCK.reduce((a,x)=>a+(Number(x.valor_estoque)||0),0);setExec('Valor em estoque',br(total));
  let mins=[];try{mins=typeof minimumBaseRows==='function'?minimumBaseRows():[]}catch(e){}
  setExec('Necessidade bruta de reposição',br(mins.reduce((a,x)=>a+(Number(x.need_value)||0),0)));setExec('Itens abaixo do mínimo',n0(mins.filter(x=>x.status==='ABAIXO DO MÍNIMO'||x.status==='SEM ESTOQUE').length));
  window.CURRENT_STOCK_META=P.meta||{};
  setTimeout(()=>{try{document.querySelector('#view-executivo .capital-crumb[data-level="local"]')?.click()}catch(e){}},0);
  window.dispatchEvent(new CustomEvent('stock-position-updated',{detail:P.meta||{}}));
})();
