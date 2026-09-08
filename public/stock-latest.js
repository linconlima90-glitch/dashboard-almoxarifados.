// Aplica a posição de estoque de 08/09/2026 15:30, incluindo Almoxarifado TI.
(function(){
const D=window.LATEST_STOCK_DELTA||{a:[],r:[],c:[]};
const cols=['empresa','codigo_local','local','codigo','produto','grupo','un','estoque','custo_estoque','valor_estoque'];
const key=x=>String(x.local)+'|'+String(x.codigo);
const rem=new Set((D.r||[]).map(x=>x[0]+'|'+x[1]));
for(let i=STOCK.length-1;i>=0;i--) if(rem.has(key(STOCK[i]))) STOCK.splice(i,1);
const by=new Map(STOCK.map(x=>[key(x),x]));
for(const [loc,cod,patch] of (D.c||[])){const x=by.get(loc+'|'+cod);if(x)Object.assign(x,patch)}
for(const row of (D.a||[])){
  const a={}; cols.forEach((c,i)=>a[c]=row[i]);
  STOCK.push({...a,min_preco:0,forn_min:'',data_min:'',max_preco:0,forn_max:'',data_max:'',ultimo_preco:0,ultimo_forn:'',data_ultimo:'',preco_medio:0,fornecedores:0,registros:0,variacao:null,dif_estoque_min:0,status_preco:'SEM HISTÓRICO DE COMPRA',qtd_baixada:0,media_mensal:0,cobertura:null,status_consumo:'SEM DADOS DE BAIXA',fornecedores_lista:[]});
}
STOCK.sort((a,b)=>(b.valor_estoque||0)-(a.valor_estoque||0)||String(a.local).localeCompare(String(b.local),'pt-BR'));

// Atualiza produtos consolidados.
const pOld=new Map(PRODUCTS.map(x=>[String(x.codigo),x])),pa=new Map();
for(const x of STOCK){const c=String(x.codigo);let a=pa.get(c);if(!a){a={q:0,v:0,loc:new Set(),g:new Map(),u:new Map(),n:new Map()};pa.set(c,a)}a.q+=Number(x.estoque)||0;a.v+=Number(x.valor_estoque)||0;a.loc.add(x.local);a.g.set(x.grupo,(a.g.get(x.grupo)||0)+1);a.u.set(x.un,(a.u.get(x.un)||0)+1);a.n.set(x.produto,(a.n.get(x.produto)||0)+1)}
const top=m=>[...m.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'';const np=[];
for(const [c,a] of pa){let p={...(pOld.get(c)||{codigo:Number(c),min_preco:0,forn_min:'',data_min:'',nota_min:null,max_preco:0,forn_max:'',data_max:'',nota_max:null,ultimo_preco:0,ultimo_forn:'',data_ultimo:'',nota_ultimo:null,preco_medio:0,fornecedores:0,registros:0,variacao:null,fornecedores_lista:[],valor_comprado:0,qtd_comprada:0,status:'SEM HISTÓRICO DE COMPRA'})};p.codigo=Number(c);p.produto=top(a.n);p.grupo=top(a.g);p.un=top(a.u);p.estoque=a.q;p.valor_estoque=a.v;p.custo_medio_estoque=a.q?a.v/a.q:0;p.locais=a.loc.size;np.push(p)}
np.sort((a,b)=>(b.valor_estoque||0)-(a.valor_estoque||0));PRODUCTS.splice(0,PRODUCTS.length,...np);

// Atualiza saldo e necessidade na base de estoque mínimo.
const sm=new Map();for(const x of STOCK){const k=key(x),y=sm.get(k)||{stock:0,value:0,cost:0};y.stock+=Number(x.estoque)||0;y.value+=Number(x.valor_estoque)||0;y.cost=y.stock?y.value/y.stock:(Number(x.custo_estoque)||y.cost);sm.set(k,y)}
for(const x of MOVEMENTS){const y=sm.get(String(x.local)+'|'+String(x.codigo));const stock=y?y.stock:0,cost=y&&y.cost>0?y.cost:(Number(x.cost)||0),avg=Number(x.avg)||0,minimum=Number(x.minimum)||0,total=Number(x.total)||0;const continuous=MINIMUM_CONTINUOUS_UNITS.has(String(x.un||'').toUpperCase()),raw=Math.max(minimum-stock,0),need=continuous?Math.ceil((raw-1e-10)*100)/100:Math.ceil(raw-1e-10);x.stock=stock;x.cost=cost;x.stock_value=stock*cost;x.coverage=avg>0?stock/avg:null;x.need=need;x.need_value=need*cost;x.excess=Math.max(stock-minimum,0);if(!(total>0))x.status='SEM DADOS DE BAIXA';else if(!(avg>0))x.status='HISTÓRICO PARCIAL';else if(stock<=0)x.status='SEM ESTOQUE';else if(stock<minimum-1e-9)x.status='ABAIXO DO MÍNIMO';else if(stock<minimum*1.25-1e-9)x.status='ATENÇÃO';else x.status='OK';if('consumption_value'in x)x.consumption_value=total*cost}

// Recompõe lista de locais e inclui TI.
const old=new Map(LOCATIONS.map(x=>[x.local,x])),la=new Map();
for(const x of STOCK){let a=la.get(x.local);if(!a){a={valor:0,pos:0,codes:new Set(),hist:0,dif:0,empresa:x.empresa};la.set(x.local,a)}a.valor+=Number(x.valor_estoque)||0;a.pos++;a.codes.add(String(x.codigo));if((Number(x.registros)||0)>0)a.hist++;a.dif+=Number(x.dif_estoque_min)||0}
const nl=[];for(const [loc,a] of la){const o=old.get(loc)||{};nl.push({...o,local:loc,empresa:a.empresa,tem_estoque:true,valor_estoque:a.valor,posicoes:a.pos,produtos_estoque:a.codes.size,com_hist:a.hist,sem_hist:a.pos-a.hist,dif:a.dif,valor_comprado:o.valor_comprado||0,linhas:o.linhas||0,produtos_comprados:o.produtos_comprados||0,fornecedores:o.fornecedores||0,ultima:o.ultima||''})}nl.sort((a,b)=>b.valor_estoque-a.valor_estoque);LOCATIONS.splice(0,LOCATIONS.length,...nl);

document.querySelectorAll('header p').forEach(el=>{el.innerHTML=el.innerHTML.replace(/posição de estoque:\s*\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2})?/i,'posição de estoque: 08/09/2026 15:30')});
try{render()}catch(e){console.error('Falha ao renderizar última posição de estoque',e)}

// Atualiza KPIs executivos dependentes do saldo.
const br=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0),n0=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(v||0),pct=v=>new Intl.NumberFormat('pt-BR',{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1}).format(v||0);
function setExec(label,val){for(const el of document.querySelectorAll('.exec-kpi'))if(el.querySelector('.k')?.textContent.trim()===label){el.querySelector('.v').textContent=val;break}}
const total=STOCK.reduce((a,x)=>a+(Number(x.valor_estoque)||0),0),mm=new Map(MOVEMENTS.map(x=>[String(x.local)+'|'+String(x.codigo),x])),semGiro=STOCK.filter(x=>!((mm.get(key(x))?.total||0)>0)),semGiroVal=semGiro.reduce((a,x)=>a+(Number(x.valor_estoque)||0),0);setExec('Valor em estoque',br(total));setExec('Estoque sem giro no histórico',br(semGiroVal));setExec('Itens sem giro',n0(semGiro.length));
let mins=[];try{mins=minimumBaseRows()}catch(e){}const need=mins.reduce((a,x)=>a+(Number(x.need_value)||0),0),below=mins.filter(x=>x.status==='ABAIXO DO MÍNIMO'||x.status==='SEM ESTOQUE').length,nostock=mins.filter(x=>x.status==='SEM ESTOQUE').length;setExec('Necessidade bruta de reposição',br(need));setExec('Itens abaixo do mínimo',n0(below));setExec('Itens sem estoque com consumo',n0(nostock));
const locTable=[...document.querySelectorAll('.exec-section h3')].find(x=>x.textContent.trim()==='Estoque por almoxarifado')?.nextElementSibling?.querySelector('tbody');if(locTable)locTable.innerHTML=[...la.entries()].sort((a,b)=>b[1].valor-a[1].valor).map(([l,a])=>`<tr><td>${l}</td><td class="num">${br(a.valor)}</td><td class="num">${pct(total?a.valor/total:0)}</td></tr>`).join('');
})();