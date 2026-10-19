// Fotografia substitutiva de baixas de 01/07 a 15/10/2026 (fora de transferencias).
// Nunca somar complementos anteriores de setembro/outubro a esta fotografia.
// Dados sem atribuicao confiavel de ano permanecem no historico legado, fora do periodo certificado.
(function(){
  function install(){
  if(window.__MOVEMENT_REVISED_20261015_APPLIED)return true;
  const P=window.CURRENT_STOCK_20260911;
  const cols=P?.revised_monthly_cols||window.STOCK_REVISED_MONTHLY_20261015?.cols,
    packed=P?.revised_monthly_rows||window.STOCK_REVISED_MONTHLY_20261015?.rows;
  if(!Array.isArray(cols)||!Array.isArray(packed)||typeof MOVEMENTS==='undefined'||!Array.isArray(MOVEMENTS))return;
  const n=x=>Number(x)||0;
  const rowKey=x=>String(x.codigo_local)+'|'+String(x.codigo);
  const monthKey=x=>String(x.mes)+'|'+rowKey(x);
  const rev=packed.map(r=>Object.fromEntries(cols.map((c,i)=>[c,r[i]])));
  const preferredUnit=new Map();
  if(typeof STOCK!=='undefined')for(const x of STOCK)preferredUnit.set(rowKey(x),String(x.un||''));
  for(const x of MOVEMENTS)if(!preferredUnit.has(rowKey(x)))preferredUnit.set(rowKey(x),String(x.un||''));
  const mapRev=new Map();
  const mixedUnits=[]; // Mesmo codigo com unidades KG/SC: nao somar quantidades incompatíveis.
  const recKeys=new Set();
  const recByMonth={'2026-07':{records:0,valor:0},'2026-08':{records:0,valor:0},'2026-09':{records:0,valor:0},'2026-10':{records:0,valor:0}};
  for(const r of rev){
    if(!recByMonth[r.mes])throw Error('Mês inesperado na fotografia '+r.mes);
    const k=monthKey(r), unit=String(r.un||'');
    const expectedUnit=preferredUnit.get(rowKey(r));
    if(expectedUnit&&unit!==expectedUnit){
      mixedUnits.push({mes:r.mes,codigo_local:r.codigo_local,codigo:r.codigo,un:r.un,qtd:r.qtd,valor:r.valor,records:r.records,unidadeEstoque:expectedUnit});
      recKeys.add(rowKey(r));
      recByMonth[r.mes].records+=n(r.records);recByMonth[r.mes].valor+=n(r.valor);
      continue;
    }
    if(mapRev.has(k)){
      const prior=mapRev.get(k);
      if(String(prior.un)!==String(r.un)){
        mixedUnits.push({mes:r.mes,codigo_local:r.codigo_local,codigo:r.codigo,un:r.un,qtd:r.qtd,valor:r.valor,records:r.records});
      }else{prior.qtd+=n(r.qtd);prior.valor+=n(r.valor);prior.records+=n(r.records)}
    }else{mapRev.set(k,{...r});}
    recKeys.add(rowKey(r));
    recByMonth[r.mes].records+=n(r.records);recByMonth[r.mes].valor+=n(r.valor);
  }
  if(rev.length!==1954||Object.values(recByMonth).reduce((sum,v)=>sum+v.records,0)!==4227 ||
     Math.abs(Object.values(recByMonth).reduce((sum,v)=>sum+v.valor,0)-416477.59)>.02){
    throw Error('Totais das baixas nao conferem; atualizacao cancelada');
  }
  const pending=new Set((typeof MOVEMENT_YEAR_PENDING==='undefined'?[]:MOVEMENT_YEAR_PENDING).map(rowKey));
  const stock=new Map();
  if(typeof STOCK!=='undefined')for(const s of STOCK){const k=rowKey(s);if(!stock.has(k))stock.set(k,s)}
  const yearly=new Map((typeof MOVEMENTS_YEARLY==='undefined'?[]:MOVEMENTS_YEARLY).map(x=>[x.year+'|'+rowKey(x),x]));
  const movement=new Map(MOVEMENTS.map(x=>[rowKey(x),x]));
  window.__MOVEMENT_REVISED_20261015_APPLIED=true;
  // Atualizar anos por (codigo_local,codigo). Outubro/2026 e parcial e NAO entra na media.
  // Criar linhas anuais para codigos novos, sem atribuir o passado sem ano conhecido.
  for(const k of recKeys){
    const sample=rev.find(r=>rowKey(r)===k);
    let m=movement.get(k);
    if(!m){
      const s=stock.get(k)||{};
      m={empresa:s.empresa||'',codigo_local:String(sample.codigo_local),local:sample.local||s.local||'',grupo:sample.grupo||s.grupo||'',codigo:sample.codigo,produto:sample.produto||s.produto||'',un:sample.un||s.un||'',months:Array(12).fill(0),total:0,complete_total:0,complete_months:21,avg:0,minimum:0,stock:n(s.estoque),cost:n(s.custo_estoque),stock_value:n(s.valor_estoque),coverage:null,need:0,need_value:0,excess:0,active_month_buckets:0,consumption_value:0,status:'HISTÓRICO PARCIAL',source:'BAIXAS ERP · 01/07 A 15/10/2026',unit_source:'ESTOQUE ATUAL',cost_source:'CUSTO MEDIO DO ESTOQUE LOCAL'};
      MOVEMENTS.push(m);movement.set(k,m);
    }
    const ky='2026|'+k;
    let y=yearly.get(ky);
    if(!y){y={empresa:m.empresa,codigo_local:m.codigo_local,local:m.local,grupo:m.grupo,codigo:m.codigo,produto:m.produto,un:m.un,year:'2026',months:Array(12).fill(0),total:0,cost:m.cost||0,value:0,active_months:0,source:'BAIXAS ERP 2026',cost_source:m.cost_source||'',quality:'PARCIAL (ANTES DE JULHO A CONFIRMAR)'};
      MOVEMENTS_YEARLY.push(y);yearly.set(ky,y);
      if(typeof MINIMUM_YEAR_MAP!=='undefined')MINIMUM_YEAR_MAP.set(ky,y);
    }
  }
  for(const [k,y] of yearly){
    if(!k.startsWith('2026|'))continue;
    const codeKey=k.slice(5),sample=movement.get(codeKey);
    // Substituir integralmente 2026-07 a 2026-10, inclusive registros removidos/corrigidos.
    for(let i=6;i<=9;i++){const r=mapRev.get('2026-'+String(i+1).padStart(2,'0')+'|'+codeKey);y.months[i]=n(r?.qtd)}
    y.total=y.months.reduce((a,v)=>a+n(v),0);y.active_months=y.months.filter(x=>n(x)>0).length;
    if(sample)y.cost=n(sample.cost);
  }
  // Atualiza totais acumulados por produto e local, sem misturar legado de ano incerto.
  let pendingAffected=0;
  for(const m of MOVEMENTS){
    const k=rowKey(m),y25=yearly.get('2025|'+k),y26=yearly.get('2026|'+k);
    if(!Array.isArray(m.months)||m.months.length!==12)m.months=Array(12).fill(0);
    const flagged=pending.has(k);
    for(let i=6;i<=9;i++){
      const legacy25=flagged?0:n(y25?.months?.[i]);
      m.months[i]=legacy25+n(y26?.months?.[i]);
    }
    // A parte legada sem ano nao e reintroduzida como se fosse movimento de 2026.
    m.total=m.months.reduce((a,v)=>a+n(v),0);
    m.active_month_buckets=m.months.filter(v=>n(v)>0).length;
    if(!flagged){
      const a25=y25?.months||Array(12).fill(0),a26=y26?.months||Array(12).fill(0);
      m.complete_total=a25.reduce((a,v)=>a+n(v),0)+a26.slice(0,9).reduce((a,v)=>a+n(v),0);
      m.complete_months=21;
      m.avg=m.complete_total/21;
    }else{
      // 2025/2026 da fonte antiga continuam pendentes: nao fabricar nova media historica.
      pendingAffected++;
      m.reconciliacao_pendente=true;
      m.source=(m.source||'HISTORICO')+' · ANO ANTERIOR PENDENTE';
    }
    const oct=mapRev.get('2026-10|'+k),sep=mapRev.get('2026-09|'+k);
    m.qtd_set_20261015=n(oct?.qtd);m.valor_set_20261015=n(oct?.valor);
    m.qtd_set_202609=n(sep?.qtd);m.valor_set_202609=n(sep?.valor);
    m.consumption_value=m.total*n(m.cost);
  }
  // Demanda do CDI CHUA abrange todos os locais da rede: reconstituir apos a substituicao.
  if(typeof CDI_NETWORK_YEARLY!=='undefined'&&typeof CDI_NETWORK_YEAR_MAP!=='undefined'&&typeof CDI_NETWORK_ALL_MAP!=='undefined'){
    const byCode=new Map();
    for(const r of rev){
      const expected=preferredUnit.get(rowKey(r));
      if(expected&&String(r.un||'')!==expected)continue;
      const code=String(r.codigo),i=Number(r.mes.slice(-2))-1;
      let a=byCode.get(code);if(!a){a={months:[0,0,0,0],info:r};byCode.set(code,a)}a.months[i-6]+=n(r.qtd);
    }
    const netYears=new Map(CDI_NETWORK_YEARLY.filter(x=>x.year==='2026').map(x=>[String(x.k),x]));
    for(const [code,v] of byCode){
      if(netYears.has(code))continue;
      const x={k:code,year:'2026',produto:v.info.produto,grupo:v.info.grupo,un:v.info.un,months:Array(12).fill(0),total:0,legacy_complete_total:0};
      CDI_NETWORK_YEARLY.push(x);CDI_NETWORK_YEAR_MAP.set('2026|'+code,x);netYears.set(code,x);
    }
    for(const [code,a] of netYears){
      const v=byCode.get(code);
      for(let i=6;i<=9;i++)a.months[i]=n(v?.months[i-6]);
      a.total=a.months.reduce((sum,q)=>sum+n(q),0);
      a.legacy_complete_total=a.months.slice(0,9).reduce((sum,q)=>sum+n(q),0);
    }
    CDI_NETWORK_ALL_MAP.clear();
    for(const y of CDI_NETWORK_YEARLY){
      const code=String(y.k);let t=CDI_NETWORK_ALL_MAP.get(code);
      if(!t){t={codigo:code,produto:y.produto,grupo:y.grupo,un:y.un,months:Array(12).fill(0),total:0,complete_total:0};CDI_NETWORK_ALL_MAP.set(code,t)}
      for(let i=0;i<12;i++)t.months[i]+=n(y.months[i]);
      t.total+=n(y.total);t.complete_total+=n(y.legacy_complete_total);
    }
  }
  // Dados exatos da fotografia, independentemente de custos medios estimados para o legado.
  window.MOVEMENTS_OCTOBER_META={from:'01/10/2026',to:'15/10/2026',records:recByMonth['2026-10'].records,value:Math.round(recByMonth['2026-10'].valor*100)/100};
  window.MOVEMENTS_REVISED_META={from:'01/07/2026',to:'15/10/2026',records:4227,value:416477.59,
    months:recByMonth,monthlyRows:1954,pendencias:287,pendingHistoricalKeys:pendingAffected,
    reconciliation:'FOTOGRAFIA SUBSTITUTIVA',snapshot:true,mixedUnits};
  if(typeof STOCK!=='undefined'){
    const by=new Map(MOVEMENTS.map(x=>[rowKey(x),x]));
    for(const s of STOCK){const m=by.get(rowKey(s));s.qtd_baixada=n(m?.total);s.media_mensal=n(m?.avg);
      s.cobertura=s.media_mensal>0?n(s.estoque)/s.media_mensal:null;
      s.status_consumo=s.qtd_baixada>0?'COM BAIXA NO PERIODO':(m?'SEM BAIXA NO PERIODO':'SEM DADOS DE BAIXA');}
  }
  // Evidenciar no painel a janela exata do ERP, distinta do historico legado.
  const summary=document.querySelector('#view-baixas');
  if(summary&&!document.getElementById('baixas-snapshot-20261015')){
    const box=document.createElement('div');box.id='baixas-snapshot-20261015';
    box.style.cssText='background:#f5f9f6;border:1px solid #cfe3d3;border-left:4px solid #1e8747;padding:11px 15px;border-radius:10px;color:#214e32;font-size:12px;margin:10px 0 14px;line-height:1.65';
    box.innerHTML='<b>Baixas conferidas do ERP (sem transferencias): 01/07 a 15/10/2026</b> · 4.227 lancamentos · <b>R$ 416.477,59</b>.'+
      '<div style="color:#657366;font-size:11px">Os valores por produto fora deste periodo sao estimados pelo custo de estoque. 287 chaves antigas seguem em conciliacao. Divergencias de unidade (KG/SC e KG/FD) sao mantidas separadamente, sem somar quantidades de unidades distintas.</div>';
    summary.prepend(box);
  }
  // Nao manter em memoria uma segunda copia da fotografia de julho-outubro.
  delete P.revised_monthly_rows;
  try{if(typeof render==='function')render()}catch(e){console.warn('Baixas revistas: render',e)}
  window.dispatchEvent(new CustomEvent('movements-updated',{detail:window.MOVEMENTS_REVISED_META}));
  return true;
  }
  window.addEventListener('stock-position-updated',install);
  install();
})();