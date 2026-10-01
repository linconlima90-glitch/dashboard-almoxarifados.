// Complemento de baixas de 01/10/2026 - fora de transferencias
(function(){
const U=[["ALMOXARIFADO GERAL F SJ",107243,100.0,634.95,"DISCO CORTE 7 X 1.6 X 22.2MM","FERRAMENTAS","UN","50115"],["ALMOXARIFADO GERAL F SJ",131550,15.0,206.68,"DISCO FLAP CONICO 7/8 X 7'' GRAO 80","FERRAMENTAS","UN","50115"],["ALMOXARIFADO GERAL F SJ",100792,12.0,26.4,"PORCA POLIDA 3/4\"","PARAFUSOS PINOS PORCAS E ARRUELAS","PC","50115"],["ALMOXARIFADO GERAL F SJ",115403,11.0,137.37,"DISCO DE CORTE 10\" X 1/8 X 5/8","FERRAMENTAS","UN","50115"],["ALMOXARIFADO GERAL F SJ",106986,8.0,60.09,"DISCO DE DESBASTE 4.1/2 X 1/4 X 7/8\"","FERRAMENTAS","UN","50115"],["ALMOXARIFADO GERAL F SJ",109572,6.0,510.0,"VALVULA BOMBA JACTO J500 407825","OUTRAS PECAS","PC","50115"],["ALMOXARIFADO GERAL F SJ",122742,5.0,10.25,"ABRACADEIRA ACO ROSCA SEM FIM 14 X 22MM - 9/16 X 7/8\"","ABRACADEIRAS","UN","50115"],["ALMOXARIFADO GERAL F SJ",104393,4.0,5.24,"ARRUELA LISA 1\"","PARAFUSOS PINOS PORCAS E ARRUELAS","UN","50115"],["ALMOXARIFADO GERAL F SJ",107625,4.0,6.4,"PARAFUSO SEXTAVADO ACO ZINCADO 1/2 X 1\"","PARAFUSOS PINOS PORCAS E ARRUELAS","UN","50115"],["ALMOXARIFADO GERAL F SJ",106440,4.0,3.8,"PORCA SEXTAVADA 1/2\"","PARAFUSOS PINOS PORCAS E ARRUELAS","UN","50115"],["ALMOXARIFADO GERAL F SJ",131934,4.0,0.96,"PORCA SEXTAVADA 5/16\"","PARAFUSOS PINOS PORCAS E ARRUELAS","PC","50115"],["ALMOXARIFADO GERAL F SJ",103032,4.0,0.71,"ARRUELA LISA 5/16''","PARAFUSOS PINOS PORCAS E ARRUELAS","UN","50115"],["ALMOXARIFADO OFICINA CAMINHOES PATOS",134841,3.0,1.68,"ABRACADEIRA NYLON 280MM","ABRACADEIRAS","PC","10114"],["ALMOXARIFADO GERAL F SJ",147919,4.0,14.4,"PINO GRAMPO R 3/16 X 110MM","PARAFUSOS PINOS PORCAS E ARRUELAS","PC","50115"],["ALMOXARIFADO GERAL F SJ",112640,3.0,1.17,"CORDA DE SEDA 3MM","OUTRAS PECAS","MT","50115"],["ALMOXARIFADO GERAL F SJ",109801,2.0,3.6,"PARAFUSO SEXTAVADO ACO ZINCADO 12 X 40","PARAFUSOS PINOS PORCAS E ARRUELAS","UN","50115"],["ALMOXARIFADO OFICINA CAMINHOES PATOS",101497,2.0,1.46,"FUSIVEL LAMINA 20A","MATERIAL ELETRICO","PC","10114"],["ALMOXARIFADO OFICINA CAMINHOES PATOS",143827,2.0,8.24,"ABRACADEIRA NYLON 580MM","ABRACADEIRAS","PC","10114"],["ALMOXARIFADO GERAL F SJ",105106,1.0,20.0,"CORREIA A-62","CORREIAS","PC","50115"],["ALMOXARIFADO GERAL F SJ",107629,1.0,5.11,"PARAFUSO SEXTAVADO ACO ZINCADO 16 X 50","PARAFUSOS PINOS PORCAS E ARRUELAS","UN","50115"],["ALMOXARIFADO GERAL F SJ",144300,1.0,30.0,"SILICONE INCOLOR 255ML 240GR","OUTRAS PECAS","UN","50115"],["ALMOXARIFADO GERAL F SJ",104176,1.0,14.17,"ARAME RECOZIDO 18","MATERIAL DE CONSTRUCAO","KG","50115"],["ALMOXARIFADO GERAL F SJ",123611,1.0,13.26,"RETENTOR 6739 40043 45 X 85 X 10","ANEIS DE VEDACAO JUNTAS BUCHAS E RETENTORES","PC","50115"],["ALMOXARIFADO GERAL F SJ",123235,1.0,20.15,"UNIAO PVC SOLDAVEL 32MM","MATERIAL HIDRAULICO","UN","50115"],["ALMOXARIFADO GERAL F SJ",103781,1.0,1.52,"ADAPTADOR REGISTRO PVC SOLDAVEL 32X1\"","MATERIAL HIDRAULICO","UN","50115"],["ALMOXARIFADO GERAL F SJ",105551,1.0,6.07,"FITA ISOLANTE 10MT","MATERIAL ELETRICO","PC","50115"],["ALMOXARIFADO GERAL F SJ",111609,1.0,7.6,"PARAFUSO SEXTAVADO ACO ZINCADO 16 X 90","PARAFUSOS PINOS PORCAS E ARRUELAS","UN","50115"],["ALMOXARIFADO GERAL F SJ",109701,1.0,1.45,"PORCA POLIDA TRAVANTE 16MM","PARAFUSOS PINOS PORCAS E ARRUELAS","UN","50115"],["ALMOXARIFADO GERAL F SJ",118324,1.0,200.0,"TERMINAL CARDAN CC 604","CRUZETAS CARDANS E SUAS PARTES","PC","50115"],["ALMOXARIFADO OFICINA CAMINHOES PATOS",119489,1.0,74.57,"FILTRO DE COMBUSTIVEL WK1060/1","FILTROS","PC","10114"],["ALMOXARIFADO OFICINA CAMINHOES PATOS",105603,1.0,84.17,"FILTRO COMBUSTIVEL E500KP02D36","FILTROS","PC","10114"],["ALMOXARIFADO OFICINA CAMINHOES PATOS",113229,1.0,289.81,"FILTRO DE AR C2713203","FILTROS","UN","10114"],["ALMOXARIFADO OFICINA CAMINHOES PATOS",102439,1.0,20.2,"LAMPADA H1 24V","MATERIAL ELETRICO","PC","10114"],["ALMOXARIFADO GERAL F SJ",109797,1.0,1.78,"CONTRA PINO 1/4 X 3\"","OUTRAS PECAS","PC","50115"],["ALMOXARIFADO GERAL F SJ",104382,1.0,1.04,"PARAFUSO SEXTAVADO ACO ZINCADO 3/8 X 1.1/2\"","PARAFUSOS PINOS PORCAS E ARRUELAS","UN","50115"],["ALMOXARIFADO GERAL F SJ",104409,1.0,59.49,"CADEADO NR50","OUTRAS PECAS","PC","50115"]];
function apply(){
  if(typeof MOVEMENTS==='undefined'||!Array.isArray(MOVEMENTS)||window.__MOVEMENT_20261001_APPLIED)return;
  window.__MOVEMENT_20261001_APPLIED=true;
  const by=new Map(MOVEMENTS.map(x=>[String(x.local)+'|'+String(x.codigo),x]));
  const stockBy=new Map();
  if(typeof STOCK!=='undefined'&&Array.isArray(STOCK))for(const s of STOCK){const k=String(s.local)+'|'+String(s.codigo);if(!stockBy.has(k))stockBy.set(k,s)}
  for(const r of U){
    const [local,codigo,qtd,valor,produto,grupo,un,codigo_local]=r,k=String(local)+'|'+String(codigo);let x=by.get(k);
    if(!x){
      const s=stockBy.get(k)||{};
      x={local,codigo,produto:produto||s.produto||'',grupo:grupo||s.grupo||'',un:un||s.un||'',codigo_local:codigo_local||s.codigo_local||'',total:0,avg:0,minimum:0,cost:(qtd>0?valor/qtd:0)||(Number(s.custo_estoque)||0)};
      MOVEMENTS.push(x);by.set(k,x);
    }
    if(Number(x.qtd_set_20261001)>0)continue;
    x.total=(Number(x.total)||0)+qtd;
    x.qtd_set_20261001=qtd;x.valor_set_20261001=valor;
    // Outubro ainda e parcial: atualiza o consumo acumulado sem alterar a media mensal/minimo de 4 meses.
    if(!(Number(x.cost)>0)&&qtd>0)x.cost=valor/qtd;
  }
  const sm=new Map();
  if(typeof STOCK!=='undefined'&&Array.isArray(STOCK))for(const s of STOCK){const k=String(s.local)+'|'+String(s.codigo),y=sm.get(k)||{stock:0,value:0,cost:0};y.stock+=Number(s.estoque)||0;y.value+=Number(s.valor_estoque)||0;y.cost=y.stock?y.value/y.stock:(Number(s.custo_estoque)||y.cost);sm.set(k,y)}
  for(const x of MOVEMENTS){
    const y=sm.get(String(x.local)+'|'+String(x.codigo)),stock=y?y.stock:0,cost=y&&y.cost>0?y.cost:(Number(x.cost)||0),avg=Number(x.avg)||0,minimum=Number(x.minimum)||0,total=Number(x.total)||0;
    const continuous=typeof MINIMUM_CONTINUOUS_UNITS!=='undefined'&&MINIMUM_CONTINUOUS_UNITS.has(String(x.un||'').toUpperCase()),raw=Math.max(minimum-stock,0),need=continuous?Math.ceil((raw-1e-10)*100)/100:Math.ceil(raw-1e-10);
    x.stock=stock;x.cost=cost;x.stock_value=stock*cost;x.coverage=avg>0?stock/avg:null;x.need=need;x.need_value=need*cost;x.excess=Math.max(stock-minimum,0);
    if(!(total>0))x.status='SEM DADOS DE BAIXA';else if(!(avg>0))x.status='HISTÓRICO PARCIAL';else if(stock<=0)x.status='SEM ESTOQUE';else if(stock<minimum-1e-9)x.status='ABAIXO DO MÍNIMO';else if(stock<minimum*1.25-1e-9)x.status='ATENÇÃO';else x.status='OK';
    if('consumption_value'in x)x.consumption_value=total*cost;
  }
  if(typeof STOCK!=='undefined'&&Array.isArray(STOCK)){
    const mm=new Map(MOVEMENTS.map(x=>[String(x.local)+'|'+String(x.codigo),x]));
    for(const s of STOCK){const m=mm.get(String(s.local)+'|'+String(s.codigo));s.qtd_baixada=Number(m?.total)||0;s.media_mensal=Number(m?.avg)||0;s.cobertura=s.media_mensal>0?(Number(s.estoque)||0)/s.media_mensal:null;s.status_consumo=s.qtd_baixada>0?'COM BAIXA NO PERÍODO':(m?'SEM BAIXA NO PERÍODO':'SEM DADOS DE BAIXA')}
  }
  try{if(typeof render==='function')render()}catch(e){console.warn('Baixas 01/10: render',e)}
  try{if(typeof renderMinimum==='function')renderMinimum()}catch(e){}
  try{if(typeof renderCDI==='function')renderCDI()}catch(e){}
  window.dispatchEvent(new CustomEvent('movements-updated',{detail:{"from":"01/10/2026","to":"01/10/2026","records":38,"quantity":211.0,"value":2483.79}}));
}
apply();
})();