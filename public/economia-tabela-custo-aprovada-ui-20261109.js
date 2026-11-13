// Diretoria: comparação auditável das compras com a Tabela Custo, versão aprovada 09/11/2026.
// Referência é o maior custo gerencial por código; a tabela não contém unidade ou nota fiscal.
// Resultado gerencial calculado na aquisição: não se soma novamente a transferências nem consumo.
(function(){
  'use strict';
  if(document.documentElement.dataset.dbPilot==='1' || document.getElementById('db-cost-table-approved-panel'))return;
  const host=document.getElementById('cdi-distribution-purchases')||document.getElementById('cdi-transfer-panel');
  const packed=window.DB_COST_TABLE_COMPARE_CORRECTED_GZIP;
  if(!host||!packed)return;
  const panel=document.createElement('section');panel.id='db-cost-table-approved-panel';panel.className='ct-ap';
  panel.innerHTML='<h2>Economia gerencial · Tabela Custo</h2><p>Carregando o cruzamento aprovado...</p>';
  host.insertAdjacentElement('afterend',panel);
  const mBR=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const pBR=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:4});
  const numberBR=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:4});
  const intBR=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0});
  const money=n=>mBR.format((Number(n)||0)/100);
  const price=n=>n==null?'—':pBR.format(Number(n)/1e6);
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  const dBR=s=>String(s||'').split('-').reverse().join('/');
  const css=document.createElement('style');css.id='db-cost-table-approved-css';css.textContent=`
  #db-cost-table-approved-panel{--c:#195c39;--ink:#214b34;--muted:#6d8275;--line:#dce8df;background:white;border:1px solid #d5e5da;border-radius:16px;margin:18px 0;padding:23px 25px;box-shadow:0 4px 20px rgba(25,62,39,.045);color:var(--ink);font-family:inherit}
  #db-cost-table-approved-panel *{box-sizing:border-box}
  #db-cost-table-approved-panel .ct-eyebrow{font-size:10px;color:#548568;font-weight:800;letter-spacing:.08em;margin-bottom:7px}
  #db-cost-table-approved-panel .ct-title{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
  #db-cost-table-approved-panel h2{font-size:21px;letter-spacing:-.02em;font-weight:850;margin:0 0 8px;color:#174b2f}
  #db-cost-table-approved-panel h3{font-size:14px;font-weight:850;color:#21563b;margin:0 0 8px}
  #db-cost-table-approved-panel p{font-size:11px;line-height:1.55;color:var(--muted);margin:0}
  #db-cost-table-approved-panel .ct-status{white-space:nowrap;background:#fff4d9;color:#8b6719;border:1px solid #ead6a3;border-radius:7px;padding:8px 10px;font-size:10px;font-weight:850}
  #db-cost-table-approved-panel .ct-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:17px 0}
  #db-cost-table-approved-panel .ct-kpi{border:1px solid var(--line);border-radius:12px;background:#f8fcf9;padding:15px;min-width:0}
  #db-cost-table-approved-panel .ct-kpi.primary{background:linear-gradient(115deg,#e5f4eb,#f6fcf7);border-color:#b8ddc7}
  #db-cost-table-approved-panel .ct-kpi small{display:block;font-size:10px;color:#557e61;min-height:30px;line-height:1.45}
  #db-cost-table-approved-panel .ct-kpi strong{display:block;font-size:22px;color:#175d37;letter-spacing:-.04em;font-variant-numeric:tabular-nums;margin:6px 0 4px}
  #db-cost-table-approved-panel .ct-kpi span{font-size:10px;color:#758b78}
  #db-cost-table-approved-panel .ct-kpi.negative strong{color:#b24c38}
  #db-cost-table-approved-panel .ct-notes{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0}
  #db-cost-table-approved-panel .ct-note{padding:12px 14px;background:#fbfdfb;border:1px solid #deebe1;border-radius:9px}
  #db-cost-table-approved-panel .ct-note strong{display:block;font-size:11px;color:#20573a;margin-bottom:5px}
  #db-cost-table-approved-panel .ct-note.warn{background:#fffbef;border-color:#f0dfb1}
  #db-cost-table-approved-panel .ct-note.warn strong{color:#825a1f}
  #db-cost-table-approved-panel .ct-breakdown{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-bottom:15px}
  #db-cost-table-approved-panel .ct-farm{border:1px solid var(--line);border-radius:9px;background:#fff;padding:11px;text-align:left;cursor:pointer}
  #db-cost-table-approved-panel .ct-farm:hover,#db-cost-table-approved-panel .ct-farm:focus-visible{background:#f1f9f4;outline:none;border-color:#95cbaa}
  #db-cost-table-approved-panel .ct-farm[aria-pressed=true]{background:#e7f5ec;border-color:#80b99a}
  #db-cost-table-approved-panel .ct-farm>div:first-child{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
  #db-cost-table-approved-panel .ct-farm b{font-size:11px;color:#214b34}
  #db-cost-table-approved-panel .ct-farm strong{font-size:12px;color:#17643a;white-space:nowrap}
  #db-cost-table-approved-panel .ct-farm small{font-size:10px;color:#809284}
  #db-cost-table-approved-panel .ct-track{width:100%;height:5px;border-radius:8px;background:#eaf3ed;overflow:hidden;margin:8px 0 5px}
  #db-cost-table-approved-panel .ct-track i{height:5px;background:#4b9b69;display:block;border-radius:8px}
  #db-cost-table-approved-panel details{border:1px solid var(--line);border-radius:10px;overflow:hidden}
  #db-cost-table-approved-panel details>summary{background:#f3f9f5;padding:15px;font-size:12px;font-weight:850;cursor:pointer;list-style:none}
  #db-cost-table-approved-panel details>summary::-webkit-details-marker{display:none}
  #db-cost-table-approved-panel .ct-detail-body{padding:15px}
  #db-cost-table-approved-panel .ct-filters{display:grid;grid-template-columns:repeat(4,minmax(125px,1fr)) minmax(165px,1.4fr) auto;gap:8px;align-items:end}
  #db-cost-table-approved-panel .ct-filters label{font-size:10px;font-weight:800;color:#55725e;min-width:0}
  #db-cost-table-approved-panel select,#db-cost-table-approved-panel input{display:block;margin-top:5px;height:35px;width:100%;min-width:0;padding:6px 8px;border-radius:7px;border:1px solid #cbdcd0;background:white;font-size:11px;color:#224733}
  #db-cost-table-approved-panel button.ct-reset,#db-cost-table-approved-panel button.ct-csv{background:#eaf6ee;border:1px solid #9ac7ac;color:#1b643e;padding:9px 12px;border-radius:7px;min-height:35px;font-size:11px;cursor:pointer;font-weight:800}
  #db-cost-table-approved-panel .ct-csv{background:#1c7144!important;color:white!important}
  #db-cost-table-approved-panel .ct-row-summary{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;padding:11px 12px;background:#f7fbf8;border:1px solid #e2ede5;border-radius:8px;font-size:11px;margin:12px 0}
  #db-cost-table-approved-panel .ct-row-summary strong{color:#176138}
  #db-cost-table-approved-panel .ct-scroll{overflow:auto;max-height:435px;border:1px solid var(--line);border-radius:8px}
  #db-cost-table-approved-panel table{border-collapse:collapse;width:100%;min-width:1100px;font-size:10px}
  #db-cost-table-approved-panel th{background:#eaf4ed;position:sticky;top:0;text-align:left;color:#2d6543;font-weight:850;white-space:nowrap;padding:10px 9px;z-index:1}
  #db-cost-table-approved-panel td{border-bottom:1px solid #e6eee8;padding:9px;color:#435e4c;vertical-align:top}
  #db-cost-table-approved-panel .ct-num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
  #db-cost-table-approved-panel .ct-pos{color:#137040;font-weight:850}
  #db-cost-table-approved-panel .ct-neg{color:#b04d37;font-weight:850}
  #db-cost-table-approved-panel .ct-product{cursor:pointer}
  #db-cost-table-approved-panel .ct-product:hover td{background:#f5faf6}
  #db-cost-table-approved-panel .ct-paper{padding:14px;border-radius:9px;border:1px solid #d7e7dc;margin-top:12px;background:#f8fcf9;overflow:auto}
  #db-cost-table-approved-panel .ct-paper h4{margin:0 0 9px;font-size:13px;color:#215839}
  #db-cost-table-approved-panel .ct-paper p{margin-bottom:9px}
  #db-cost-table-approved-panel .ct-paper table{min-width:890px}
  #db-cost-table-approved-panel .ct-foot{padding-top:13px;border-top:1px solid #dfebe3;font-size:10px!important;margin-top:15px!important}
  @media(max-width:1050px){#db-cost-table-approved-panel .ct-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}#db-cost-table-approved-panel .ct-filters{grid-template-columns:repeat(3,minmax(130px,1fr))}}
  @media(max-width:690px){#db-cost-table-approved-panel{padding:16px 14px}#db-cost-table-approved-panel .ct-title{flex-direction:column}#db-cost-table-approved-panel .ct-notes{grid-template-columns:1fr}#db-cost-table-approved-panel .ct-breakdown{grid-template-columns:1fr}#db-cost-table-approved-panel .ct-filters{grid-template-columns:1fr}#db-cost-table-approved-panel .ct-kpi strong{font-size:19px}}
  `;
  document.head.appendChild(css);

  // Aplica a referencia corrigida a todas as compras do produto antes de exibir
  // KPIs, provas por nota e API do painel consolidado, sem editar o ERP.
  function aplicarReferenciasAprovadas(data){
    const M=data.meta,P=data.products,T=data.purchases;
    if(M.approvedReferenceCorrections?.['105090'])return;
    const override=window.DB_COST_TABLE_REFERENCE_OVERRIDES?.['105090'];
    if(!override || override.approvedMaxMicro!==24235000 || override.previousMaxMicro!==242350000)
      throw Error('Referencia autorizada para o eletrodo 105090 ausente.');
    const product=P.find(r=>r[1]==='105090'&&r[4]==='KG');
    const buys=T.filter(r=>r[2]==='105090'&&r[5]==='KG');
    if(!product||product[6]!==override.previousMaxMicro||buys.length!==2||
       buys.reduce((s,r)=>s+r[11],0)!==8574719||
       buys.reduce((s,r)=>s+r[8],0)!==390)
      throw Error('Base do eletrodo 105090 mudou: revisar antes de substituir os valores.');
    let oldPositive=0,oldNegative=0,newPositive=0,newNegative=0;
    for(const r of buys){
      oldPositive+=r[11];oldNegative+=r[12];
      // Preco unitario em micros de real; valor da diferenca em centavos.
      const signed=Math.round((override.approvedMaxMicro-r[10])*r[8]/10000);
      r[11]=Math.max(0,signed);
      r[12]=Math.min(0,signed);
      r[13]=signed;
      newPositive+=r[11];newNegative+=r[12];
      r[19]='REFERENCIA MANUAL APROVADA';
    }
    const deltaPositive=newPositive-oldPositive,deltaNegative=newNegative-oldNegative;
    product[6]=override.approvedMaxMicro;
    product[14]+=deltaPositive;
    product[15]+=deltaNegative;
    product[16]+=deltaPositive+deltaNegative;
    M.positiveCents+=deltaPositive;
    M.negativeCents+=deltaNegative;
    M.netCents+=deltaPositive+deltaNegative;
    // O maximo antigo de agosto era posterior a ambas as compras analisadas.
    if(Number.isFinite(M.temporalCents))M.temporalCents+=deltaPositive+deltaNegative;
    if(Number.isFinite(M.approvedExceptionalPositiveCents))M.approvedExceptionalPositiveCents+=deltaPositive;
    for(const row of M.approvedOtherMaximums||[])if(row.code==='105090'){
      row.maxCost='24.235';row.reason='Referencia ajustada por orientacao de 09/11/2026';
    }
    M.approvedReferenceCorrections={
      '105090':{maxMicro:override.approvedMaxMicro,oldMaxMicro:override.previousMaxMicro,
        purchaseLines:buys.length,quantity:390,oldPositiveCents:oldPositive,
        correctedPositiveCents:newPositive,deltaCents:deltaPositive+deltaNegative,
        approvedAt:override.approvedAt}
    };
    M.confirmation+=' Nova referencia aprovada do eletrodo 105090: R$ 24,235 por KG.';
  }

  function applyPurchases1011(data){
    const pkg=window.DB_PURCHASES_20261110_DELTA,M=data.meta,P=data.products,T=data.purchases;
    if(!pkg||pkg.economy?.length!==28||pkg.meta.economyNewPaidCents!==1503593)
      throw Error('Compras novas de 10/11 sem conciliacao do ERP');
    if(P.length!==320||T.length!==381||M.purchaseCents!==21832862||
       M.positiveCents!==9536764||M.negativeCents!==-486263||M.netCents!==9050501)
      throw Error('Base original aprovada da Tabela Custo mudou');
    const bySku=new Map(P.map(p=>[p[0],p]));
    const docs=new Set(T.map(t=>[t[16],t[17],t[2],t[6]].join('|')));
    for(const v of pkg.economy){
      const [sku,date,code,desc,group,un,local,supplier,qty,paid,priceMicro,pos,neg,net,status,note,doc,seq,maxMicro,minMicro,maxDate,secondMax,refLine]=v;
      const k=[doc,seq,code,local].join('|');
      if(docs.has(k))throw Error('Compra em duplicidade na economia: '+k);
      docs.add(k);
      let p=bySku.get(sku);
      if(!p){
        p=new Array(20).fill(null);p[0]=sku;p[1]=code;p[2]=desc;p[3]=group;p[4]=un;
        p[5]=minMicro;p[6]=maxMicro;p[7]=maxDate;p[8]=secondMax;p[9]=refLine;
        p[14]=0;p[15]=0;p[16]=0;
        P.push(p);bySku.set(sku,p);
      }
      if(maxMicro!=null&&p[6]!=null&&p[6]!==maxMicro)
        throw Error('Referencia de custo inconsistente no produto '+sku);
      if(p[6]==null&&maxMicro!=null)p[6]=maxMicro;
      if(p[5]==null&&minMicro!=null)p[5]=minMicro;
      p[14]=(p[14]||0)+pos;p[15]=(p[15]||0)+neg;p[16]=(p[16]||0)+net;
      T.push([sku,date,code,desc,group,un,local,supplier,qty,paid,priceMicro,pos,neg,net,status,note,doc,seq,0,
        maxMicro==null?'SEM REFERENCIA NA TABELA CUSTO':'REFERENCIA GERENCIAL',refLine,maxDate]);
    }
    M.purchaseLines=T.length;
    M.purchaseCents=T.reduce((s,t)=>s+t[9],0);
    M.positiveCents=T.reduce((s,t)=>s+(t[11]||0),0);
    M.negativeCents=T.reduce((s,t)=>s+(t[12]||0),0);
    M.netCents=M.positiveCents+M.negativeCents;
    M.matchedLines=T.filter(t=>bySku.get(t[0])?.[6]!=null).length;
    M.projectSkus=new Set(T.map(t=>t[0])).size;
    M.localNames={...M.localNames,'50119':'São João · EPI (50119)','10101':'Local 10101'};
    M.lastUpdated='10/11/2026';M.newPurchasesAudit=pkg.meta;
    if(T.length!==409||M.purchaseCents!==23336455||M.positiveCents!==9873764||
       M.negativeCents!==-584605||M.netCents!==9289159||docs.size!==409)
      throw Error('Economia nao confere com os valores auditados de 10/11');
  }
  function applyPurchases1311(data){
    const pkg=window.DB_PURCHASES_20261113_DELTA,M=data.meta,P=data.products,T=data.purchases;
    if(!pkg||pkg.meta?.sourceSHA256!=='0fa16fc1f4d6fe7f5a00037e0741bdb802e9d52b173d34f717c10dd923c55ec1'
      ||pkg.added?.length!==8||pkg.meta.cents!==401105)
      throw Error('Remessa de 13/11 para comparativo de custo nao validada');
    if(T.length!==409||M.purchaseCents!==23336455||M.netCents!==9289159)
      throw Error('Base de economia historica mudou antes da remessa de 13/11');
    const byCodeUnit=new Map(P.map(p=>[String(p[1])+'|'+String(p[4]),p]));
    const existing=new Set(T.map(t=>[t[16],t[17],t[2],t[6]].join('|')));
    let newPaid=0,newPositive=0,newNegative=0,matched=0,missing=0;
    for(const row of pkg.added){
      const [dateBR,document,seq,code,localCode,supplierCode,supplier,
        company,companyLocal,local,group,description,unit,quantity,priceMicro,cents,status,nf]=row;
      if(status!=='LANC.RECEB.'||dateBR!=='10/11/2026')throw Error('Status do novo documento de compra divergente');
      const key=[document,seq,code,localCode].join('|');
      if(existing.has(key))throw Error('Compra repetida no comparativo: '+key);
      existing.add(key);newPaid+=cents;
      let p=byCodeUnit.get(String(code)+'|'+String(unit));
      if(!p){
        p=new Array(20).fill(null);
        p[0]='ERP|'+String(code)+'|'+String(unit);
        p[1]=String(code);p[2]=description;p[3]=group;p[4]=unit;
        p[14]=0;p[15]=0;p[16]=0;
        P.push(p);byCodeUnit.set(String(code)+'|'+String(unit),p);
      }
      const reference=p[6];
      const hasReference=Number(reference)>0;
      const signed=hasReference?Math.round((Number(reference)-priceMicro)*quantity/10000):0;
      const positive=Math.max(0,signed),negative=Math.min(0,signed);
      newPositive+=positive;newNegative+=negative;
      if(hasReference)matched++;else missing++;
      p[14]=(p[14]||0)+positive;p[15]=(p[15]||0)+negative;p[16]=(p[16]||0)+signed;
      T.push([p[0],'2026-11-10',String(code),description,group,unit,String(localCode),supplier,
        quantity,cents,priceMicro,positive,negative,signed,'LANC.RECEB.',nf,document,seq,0,
        hasReference?'REFERENCIA GERENCIAL TABELA CUSTO':'SEM REFERENCIA NA TABELA CUSTO',
        p[9]??null,p[7]??null]);
    }
    if(newPaid!==401105||T.length!==417||existing.size!==417)
      throw Error('Oito linhas novas nao fecharam na economia');
    M.purchaseLines=T.length;
    M.purchaseCents+=newPaid;
    M.positiveCents+=newPositive;
    M.negativeCents+=newNegative;
    M.netCents=M.positiveCents+M.negativeCents;
    M.matchedLines+=matched;
    M.projectSkus=new Set(T.map(t=>t[0])).size;
    M.lastUpdated='13/11/2026';
    M.newPurchasesAudit={...pkg.meta,matchedReference:matched,missingReference:missing,
      positiveCents:newPositive,negativeCents:newNegative,netCents:newPositive+newNegative};
  }
  // Referencia aprovada pelo gestor em 13/11, sem reescrever precos pagos nas NFs.
  // Recalcular apenas comparativos gerenciais que usam o custo de referencia.
  function applyApprovedCorreia124928(data){
    const item=window.DB_APPROVED_PRODUCT_COSTS?.['124928'];
    if(!item||item.custoUnitario!==7982.58||item.custoMicro!==7982580000||item.unidade!=='PC')
      throw Error('Custo gerencial aprovado da correia 124928 nao carregado');
    const M=data.meta,P=data.products,T=data.purchases;
    let product=P.find(p=>String(p[1])==='124928'&&String(p[4])==='PC');
    if(!product){
      product=new Array(20).fill(null);
      product[0]='CORRECAO|124928|PC';product[1]='124928';product[2]=item.produto;
      product[3]='CORREIAS';product[4]='PC';product[14]=0;product[15]=0;product[16]=0;
      P.push(product);
    }
    const before=product[6]??null, beforeDate=product[7]??null;
    let positiveDelta=0,negativeDelta=0,qty=0,lines=0;
    for(const r of T){
      if(String(r[2])!=='124928'||String(r[5])!=='PC')continue;
      const originalPositive=Number(r[11])||0,originalNegative=Number(r[12])||0;
      const signed=Math.round((item.custoMicro-Number(r[10]))*Number(r[8])/10000);
      if(!Number.isSafeInteger(signed))throw Error('Comparativo nao verificavel da correia 124928');
      r[11]=Math.max(0,signed);r[12]=Math.min(0,signed);r[13]=signed;
      r[19]='REFERENCIA GERENCIAL CORRIGIDA · HISTORICO FISCAL PRESERVADO';
      positiveDelta+=r[11]-originalPositive;negativeDelta+=r[12]-originalNegative;
      qty+=Number(r[8]);lines++;
    }
    product[6]=item.custoMicro;product[7]=item.dataAprovacao;
    product[9]='Orientacao de custo 13/11/2026';product[14]=(product[14]||0)+positiveDelta;
    product[15]=(product[15]||0)+negativeDelta;product[16]=(product[16]||0)+positiveDelta+negativeDelta;
    M.positiveCents+=positiveDelta;M.negativeCents+=negativeDelta;
    M.netCents+=positiveDelta+negativeDelta;
    if(Number.isFinite(M.temporalCents))M.temporalCents+=positiveDelta+negativeDelta;
    const details={code:'124928',referenceMicro:item.custoMicro,
      originalReferenceMicro:before,originalReferenceDate:beforeDate,quantity:qty,
      purchaseLines:lines,positiveDeltaCents:positiveDelta,negativeDeltaCents:negativeDelta,
      netDeltaCents:positiveDelta+negativeDelta,approvedAt:item.dataAprovacao,
      source:item.fonte,originalInvoicesPreserved:true};
    M.approvedProductCostCorrections={...(M.approvedProductCostCorrections||{}),'124928':details};
    M.confirmation=(M.confirmation||'')+
      ' Correia 124928: custo de referencia aprovado R$ 7.982,58/PC; notas fiscais originais preservadas.';
  }
  function show(data){
    aplicarReferenciasAprovadas(data);
    applyPurchases1011(data);
    applyPurchases1311(data);
    applyApprovedCorreia124928(data);
    const M=data.meta,P=data.products,T=data.purchases;
    const nov13=M.newPurchasesAudit;
    const ok=M.schemaVersion===2 && M.projectFrom==='2026-05-07' && P.length>=320 && T.length===417 &&
      M.purchaseCents===23737560 && nov13?.sourceSHA256==='0fa16fc1f4d6fe7f5a00037e0741bdb802e9d52b173d34f717c10dd923c55ec1' &&
      M.approvedProductCostCorrections?.['124928']?.referenceMicro===7982580000 &&
      M.positiveCents===9873764+nov13.positiveCents+M.approvedProductCostCorrections['124928'].positiveDeltaCents &&
      M.negativeCents===-584605+nov13.negativeCents+M.approvedProductCostCorrections['124928'].negativeDeltaCents &&
      M.netCents===9289159+nov13.netCents+M.approvedProductCostCorrections['124928'].netDeltaCents &&
      T.reduce((s,r)=>s+(r[9]||0),0)===M.purchaseCents &&
      T.reduce((s,r)=>s+(r[11]||0),0)===M.positiveCents &&
      T.reduce((s,r)=>s+(r[12]||0),0)===M.negativeCents &&
      T.every(r=>r[1]>='2026-05-07' && r[8]>0 && r[9]>0) &&
      P.find(r=>r[1]==='102902')?.[6]===23850000 && P.find(r=>r[1]==='102902')?.[8]===23470000 &&
      P.find(r=>r[1]==='105090')?.[6]===24235000 &&
      M.approvedReferenceCorrections?.['105090']?.correctedPositiveCents===68234;
    if(!ok)throw Error('A base aprovada da Tabela Custo não passou na reconciliação de valores.');
    const bySku=new Map(P.map(r=>[r[0],r]));
    const farms=new Map();for(const t of T){const k=String(t[6]);const x=farms.get(k)||{code:k,lines:0,paid:0,pos:0,neg:0};x.lines++;x.paid+=t[9];x.pos+=t[11]||0;x.neg+=t[12]||0;farms.set(k,x)}
    const farmList=[...farms.values()].sort((a,b)=>b.pos-a.pos);
    const farmName=k=>M.localNames[k]||'Local '+k;
    const stat=(label,value,sub,cls='')=>'<div class="ct-kpi '+cls+'"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong><span>'+esc(sub)+'</span></div>';
    panel.innerHTML=[
      '<div class="ct-title"><div><div class="ct-eyebrow">PROJETO CDI E ALMOXARIFADOS · DESDE 07/05/2026</div>',
      '<h2>Economia por maior custo da Tabela Custo</h2>',
      '<p>Comparamos cada compra de todas as fazendas ao maior custo gerencial válido do mesmo produto. O benefício de negociação é reconhecido na <b>compra</b>, inclusive quando o material é utilizado na Chuá ou distribuído pelo CDI.</p></div>',
      '<span class="ct-status">ESTIMATIVA GERENCIAL · NÃO HOMOLOGADA</span></div>',
      '<div class="ct-kpis">',
      stat('Diferenças favoráveis',money(M.positiveCents),M.matchedLines+' linhas de compra com referência','primary'),
      stat('Diferenças desfavoráveis',money(M.negativeCents),'Compras com preços maiores que a referência','negative'),
      stat('Saldo comparativo (favoráveis − desfavoráveis)',money(M.netCents),'Resultado líquido do comparativo, não economia contábil'),
      stat('Total comprado no período',money(M.purchaseCents),M.purchaseLines+' compras · '+M.projectSkus+' produtos/unidades'),
      '</div>',
      '<div class="ct-notes"><div class="ct-note"><strong>Referências de eletrodos corrigidas</strong><p><b>Eletrodo 105090, 2,5 mm:</b> maior custo aprovado <b>R$ 24,235/kg</b> (antes R$ 242,35). As duas compras de 390 kg somam R$ 682,34 de diferença favorável, já incluída no total acima.</p><br><strong>Correção aprovada: eletrodo 6013 3,25 mm · 102902</strong><p>O custo gerencial da linha 182 passou de R$ 234,70 para <b>R$ 23,47</b>. O maior custo válido do produto passa a ser <b>R$ 23,85</b> (linha 3242). Os demais preços elevados foram mantidos, exceto o eletrodo 105090 corrigido, conforme sua orientação. <b>'+money(M.approvedExceptionalPositiveCents)+'</b> do indicador favorável provém de seis compras com máximos excepcionais aprovados; esse valor já está incluído no total, não deve ser somado.</p></div>',
      '<div class="ct-note warn"><strong>Como interpretar esta economia</strong><p>Para cada nota: <b>máximo da Tabela Custo menos preço realmente pago, multiplicado pela quantidade</b>. O preço máximo pode ser de outra data e a Tabela Custo não contém unidade de medida. Portanto, trata-se de comparação gerencial, <b>não economia financeira comprovada</b>. Não somamos esse valor novamente nas transferências.</p></div></div>',
      '<h3>Resultado por local de compra</h3>',
      '<div class="ct-breakdown" id="ct-farms"></div>',
      '<details id="ct-details"><summary>Abrir produtos, preços máximo e mínimo e notas de compra</summary><div class="ct-detail-body">',
      '<div class="ct-filters">',
      '<label>Local<select id="ct-local"><option value="">Todas as unidades</option></select></label>',
      '<label>Mês<select id="ct-month"><option value="">Todos os meses</option></select></label>',
      '<label>Grupo<select id="ct-group"><option value="">Todos os grupos</option></select></label>',
      '<label>Produto<select id="ct-sku"><option value="">Todos os produtos</option></select></label>',
      '<label>Pesquisar<input id="ct-search" type="search" placeholder="Produto, NF, código, fornecedor"></label>',
      '<button class="ct-reset" id="ct-reset" type="button">Limpar</button></div>',
      '<div class="ct-row-summary"><span><strong id="ct-count">—</strong> compras · Valor <strong id="ct-paid">—</strong> · Favoráveis <strong id="ct-positive">—</strong> · Saldo <strong id="ct-net">—</strong></span><button type="button" class="ct-csv" id="ct-export">Exportar CSV</button></div>',
      '<div class="ct-scroll"><table><thead><tr>',
      ['Produto','Un.','Menor Tabela Custo','Maior válido','Dif. entre referências','Qtd. comprada','Valor comprado','Ganho favorável','Dif. desfavorável','Saldo do produto'].map(v=>'<th>'+esc(v)+'</th>').join(''),
      '</tr></thead><tbody id="ct-rows"></tbody></table></div>',
      '<div id="ct-proof" class="ct-paper" style="display:none"></div>',
      '<p class="ct-foot">Fonte: Tabela Custo.xlsx (5.374 registros), compras consolidadas até 09/11 e remessas 10/11 e 13/11; duplicidades removidas, pneus e câmaras fora da economia. Referência gerencial da correia 124928 corrigida para R$ 7.982,58/PC, sem alterar os preços fiscais de compra. Compras sem referência válida não geram economia estimada. Sem referência válida, o ganho é zero. A aba de auditoria mantém valores e datas do ERP, inclusive quando o custo máximo é posterior à compra.</p>',
      '</div></details>',
      '<p class="ct-foot">A Tabela Custo original permanece intacta. A correção aprovada afeta apenas a base analítica, e a mesma diferença de negociação não é duplicada no CDI, no consumo próprio ou no estoque.</p>'
    ].join('');
    const $=id=>panel.querySelector('#'+id);
    const farmButtons=farmList.map(f=>{const pct=Math.max(0,Math.min(100,100*f.pos/M.positiveCents)).toFixed(1);return '<button type="button" class="ct-farm" data-local="'+esc(f.code)+'" aria-pressed="false"><div><b>'+esc(farmName(f.code))+'</b><strong>'+money(f.pos)+'</strong></div><div class="ct-track"><i style="width:'+pct+'%"></i></div><small>'+intBR.format(f.lines)+' compras · '+money(f.paid)+' em aquisições</small></button>'}).join('');
    $('ct-farms').innerHTML=farmButtons;
    const local=$('ct-local'),month=$('ct-month'),group=$('ct-group'),sku=$('ct-sku'),search=$('ct-search');
    function option(s,value,label){const o=document.createElement('option');o.value=String(value);o.textContent=label;s.appendChild(o)}
    farmList.slice().sort((a,b)=>farmName(a.code).localeCompare(farmName(b.code),'pt-BR')).forEach(x=>option(local,x.code,farmName(x.code)+' · '+x.code));
    [...new Set(T.map(x=>x[1].slice(0,7)))].sort().reverse().forEach(x=>option(month,x,x.slice(5,7)+'/'+x.slice(0,4)));
    const inScope=t=>(!local.value||t[6]===local.value)&&(!month.value||t[1].startsWith(month.value));
    let shown=[];
    function preserve(s,values,empty){const before=s.value;s.replaceChildren();option(s,'',empty);values.forEach(x=>option(s,x.key,x.label));s.value=values.some(x=>x.key===before)?before:''}
    function updateCascade(){
      const filtered=T.filter(inScope),groups=[...new Set(filtered.map(x=>x[4]))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
      preserve(group,groups.map(x=>({key:x,label:x})),'Todos os grupos');
      const keys=[...new Set(filtered.filter(t=>!group.value||t[4]===group.value).map(t=>t[0]))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
      preserve(sku,keys.map(x=>({key:x,label:(bySku.get(x)?.[2]||x)+' ('+x+')'})),'Todos os produtos');
    }
    function matches(t){const q=norm(search.value);return inScope(t)&&(!group.value||t[4]===group.value)&&(!sku.value||t[0]===sku.value)&&(!q||norm([t[0],t[2],t[3],t[4],t[7],t[15],t[16]].join(' ')).includes(q))}
    function summarize(rows){const map=new Map();for(const t of rows){const k=t[0],x=map.get(k)||{key:k,qty:0,paid:0,pos:0,neg:0,net:0,lines:0};x.qty+=t[8];x.paid+=t[9];x.pos+=t[11]||0;x.neg+=t[12]||0;x.net+=t[13]||0;x.lines++;map.set(k,x)}return [...map.values()].sort((a,b)=>b.pos-a.pos||a.key.localeCompare(b.key))}
    function render(){
      shown=T.filter(matches);const agg=summarize(shown);
      const defaultAll=!local.value&&!month.value&&!group.value&&!sku.value&&!search.value;
      const displayed=defaultAll?P.map(x=>({key:x[0],qty:0,paid:0,pos:0,neg:0,net:0,lines:0,raw:x})).map(x=>{const z=agg.find(a=>a.key===x.key);return z||x}):agg;
      displayed.sort((a,b)=>b.pos-a.pos||a.key.localeCompare(b.key));
      $('ct-count').textContent=intBR.format(shown.length);$('ct-paid').textContent=money(shown.reduce((s,t)=>s+t[9],0));
      $('ct-positive').textContent=money(shown.reduce((s,t)=>s+(t[11]||0),0));$('ct-net').textContent=money(shown.reduce((s,t)=>s+(t[13]||0),0));
      $('ct-export').disabled=!shown.length;
      $('ct-rows').innerHTML=displayed.length?displayed.map(x=>{const r=bySku.get(x.key);if(!r)return '';return '<tr class="ct-product" data-sku="'+esc(x.key)+'" tabindex="0" title="Abrir documentos"><td><b>'+esc(r[1])+'</b><div>'+esc(r[2])+'</div></td><td>'+esc(r[4])+'</td><td class="ct-num">'+price(r[5])+'</td><td class="ct-num">'+price(r[6])+'</td><td class="ct-num">'+(r[5]!=null&&r[6]!=null?price(r[6]-r[5]):'—')+'</td><td class="ct-num">'+numberBR.format(x.qty)+'</td><td class="ct-num">'+money(x.paid)+'</td><td class="ct-num ct-pos">'+money(x.pos)+'</td><td class="ct-num ct-neg">'+money(x.neg)+'</td><td class="ct-num">'+money(x.net)+'</td></tr>'}).join(''):'<tr><td colspan="10" style="padding:20px;text-align:center">Sem resultados para os filtros.</td></tr>';
      panel.querySelectorAll('.ct-farm').forEach(x=>x.setAttribute('aria-pressed',x.dataset.local===local.value?'true':'false'));
      $('ct-proof').style.display='none';
    }
    function detail(key){
      const r=bySku.get(key);if(!r)return;
      const matches=shown.filter(t=>t[0]===key),sourceRow=r[9],el=$('ct-proof');
      el.style.display='block';el.innerHTML='<h4>'+esc(r[1])+' · '+esc(r[2])+'</h4><p><b>Menor custo da Tabela:</b> '+price(r[5])+' &nbsp; <b>Maior custo válido:</b> '+price(r[6])+' &nbsp; <b>Data do maior:</b> '+dBR(r[7])+' &nbsp; <b>Linha Tabela Custo:</b> '+esc(sourceRow??'—')+'</p>'+
       (r[1]==='102902'?'<p>Este produto teve a linha 182 corrigida de R$ 234,70 para R$ 23,47. Máximo válido remanescente: R$ 23,85 (linha 3242).</p>':'')+
        (r[1]==='105090'?'<p>Maior custo gerencial aprovado para o eletrodo 2,5 mm: R$ 24,235/kg (antes R$ 242,35/kg), segundo orientação de 09/11/2026. Valor de referência substitui o máximo original para este comparativo.</p>':'')+
       '<div class="ct-scroll"><table><thead><tr>'+['Data','NF','NUNOTA / Seq.','Local','Fornecedor','Qtd.','Preço pago','Valor pago','Máximo Tabela','Ganho favorável','Dif. desfavorável','Situação'].map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+matches.map(t=>'<tr><td>'+dBR(t[1])+'</td><td>'+esc(t[15])+'</td><td>'+esc(t[16])+'/'+esc(t[17])+'</td><td>'+esc(farmName(t[6]))+'</td><td>'+esc(t[7])+'</td><td class="ct-num">'+numberBR.format(t[8])+'</td><td class="ct-num">'+price(t[10])+'</td><td class="ct-num">'+money(t[9])+'</td><td class="ct-num">'+price(r[6])+'</td><td class="ct-num ct-pos">'+money(t[11])+'</td><td class="ct-num ct-neg">'+money(t[12])+'</td><td>'+esc(t[19])+'</td></tr>').join('')+'</tbody></table></div>';
      el.scrollIntoView({block:'nearest',behavior:'smooth'});
    }
    [local,month].forEach(x=>x.addEventListener('change',()=>{updateCascade();render()}));
    group.addEventListener('change',()=>{updateCascade();render()});sku.addEventListener('change',render);search.addEventListener('input',render);
    $('ct-reset').addEventListener('click',()=>{local.value='';month.value='';group.value='';sku.value='';search.value='';updateCascade();render()});
    panel.querySelectorAll('.ct-farm').forEach(b=>b.addEventListener('click',()=>{local.value=local.value===b.dataset.local?'':b.dataset.local;month.value='';group.value='';sku.value='';search.value='';updateCascade();render();$('ct-details').open=true;$('ct-details').scrollIntoView({behavior:'smooth',block:'nearest'})}));
    $('ct-rows').addEventListener('click',ev=>{const row=ev.target.closest('[data-sku]');if(row)detail(row.dataset.sku)});
    $('ct-rows').addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){const row=ev.target.closest('[data-sku]');if(row){ev.preventDefault();detail(row.dataset.sku)}}});
    $('ct-export').addEventListener('click',()=>{
      const header=['Data','Local','Fornecedor','Codigo','Produto','Grupo','Un','NF','NUNOTA','Seq','Quantidade','ValorPagoCentavos','PrecoPagoMicro','MaiorCustoGerencialMicro','LinhaTabela','DataMaiorCusto','FavoravelCentavos','DesfavoravelCentavos','SaldoCentavos','Situacao'];
      const dataRows=shown.map(t=>{const r=bySku.get(t[0]);return[t[1],farmName(t[6]),t[7],t[2],t[3],t[4],t[5],t[15],t[16],t[17],t[8],t[9],t[10],r?.[6]??'',t[20]??'',t[21]??'',t[11],t[12],t[13],t[19]]});
      const quote=v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
      const csv='\uFEFF'+[header,...dataRows].map(r=>r.map(quote).join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='economia_tabela_custo_corrigida_20261109.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),750);
    });
    updateCascade();render();
    window.DB_APPROVED_COST_COMPARISON={ready:true,summary:M,getProducts:()=>P.slice(),getPurchases:()=>T.slice()};
    window.dispatchEvent(new CustomEvent('cost-references-updated'));
  }
  async function load(){
    try{
      const bytes=Uint8Array.from(atob(packed),ch=>ch.charCodeAt(0));
      const response=new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
      const value=JSON.parse(await response.text());show(value);
    }catch(e){console.error('Erro ao carregar comparação corrigida Tabela Custo',e);panel.innerHTML='<h2>Apuração de economia · conferência pendente</h2><p>Não foi possível validar a base de referência: '+esc(e.message)+'. Valores anteriores não serão apresentados como atualizados.</p>'}
  }
  load();
})();
