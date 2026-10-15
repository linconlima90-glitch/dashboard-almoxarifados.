// Review the exact revised period separately from archived undated historical quantities.
(function(){
 const d=window.DB_REFRESH_META;if(!d)return;
 const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0),num=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(Number(v)||0);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const css=document.createElement('style');css.textContent='.revision-box{background:#fff;border:1px solid #cadbce;border-left:4px solid #1e8747;border-radius:12px;padding:14px 16px;margin:12px 0;font-size:12px;color:#304439}.revision-box h3{margin:0 0 8px;color:#0d4726;font-size:15px}.revision-box p{line-height:1.5;margin:8px 0}.revision-box select,.revision-box input{padding:8px;margin:6px 8px 6px 0;max-width:100%;border:1px solid #cadbce;border-radius:7px}.revision-box table{width:100%;border-collapse:collapse;font-size:11px}.revision-box th,.revision-box td{padding:8px;text-align:left;border-bottom:1px solid #e2e9e4}.revision-box .num{text-align:right}.revision-box summary{cursor:pointer;font-weight:700;padding:8px 0}.revision-warning{color:#815600;background:#fff7dd;padding:9px;border-radius:6px}.revision-scroll{max-height:420px;overflow:auto}';document.head.appendChild(css);
 function mount(area,local){
  if(!area||area.querySelector('.revision-box'))return;
  const box=document.createElement('section');box.className='revision-box';
  box.innerHTML='<h3>Baixas revisadas: 01/07 a 15/10/2026</h3><p>O período foi substituído, não somado ao relatório anterior. Custos abaixo são os registrados no novo relatório, sem transferências. Estoque mínimo: <b>2 meses</b>; outubro permanece parcial.</p><div class="revision-warning">Histórico antigo sem ano identificado foi arquivado separadamente em '+num(d.pendingHistory)+' combinações de produto/local. Nesses itens, média e reposição usam somente julho a setembro de 2026, sem misturar totais possivelmente sobrepostos.</div><details><summary>Conferir valores por mês e produto</summary><select aria-label="Local da conferência"></select><input type="search" placeholder="Código ou produto" aria-label="Buscar na conferência"><div class="revision-totals"></div><div class="revision-scroll"></div><p>Quantidades permanecem por produto e unidade; não somamos peças, litros e quilogramas como uma única quantidade.</p></details>';
  const select=box.querySelector('select'),search=box.querySelector('input'),details=box.querySelector('details');
  const names=[...new Set(d.rows.map(r=>r[0]))].sort();select.innerHTML='<option value="">Todos os locais do relatório</option>'+names.map(n=>'<option value="'+esc(n)+'">'+esc(n)+'</option>').join('');
  if(local){select.value=local;select.disabled=true}
  function draw(){if(!details.open)return;const q=search.value.trim().toUpperCase(),loc=select.value,rows=d.rows.filter(r=>(!loc||r[0]===loc)&&(!q||String(r[1]).includes(q)||r[2].toUpperCase().includes(q)));
   const months=d.monthly.map((m,i)=>({name:m.month,count:rows.reduce((s,r)=>s+r[7][i],0),value:rows.reduce((s,r)=>s+Math.round(r[6][i]*100),0)/100}));
   box.querySelector('.revision-totals').innerHTML='<table><thead><tr><th>Mês</th><th>Lançamentos</th><th>Custo registrado</th></tr></thead><tbody>'+months.map(m=>'<tr><td>'+esc(m.name)+(m.name==='10/2026'?' (parcial)':'')+'</td><td>'+num(m.count)+'</td><td>'+money(m.value)+'</td></tr>').join('')+'</tbody></table>';
   box.querySelector('.revision-scroll').innerHTML='<table><thead><tr><th>Local</th><th>Código / produto</th><th>Un.</th><th>Jul</th><th>Ago</th><th>Set</th><th>Out*</th><th>Custo do período</th></tr></thead><tbody>'+rows.slice(0,250).map(r=>'<tr><td>'+esc(r[0])+'</td><td>'+esc(r[1])+' - '+esc(r[2])+(r[8]==='PENDING'?'<br><small>Histórico anterior sem ano: arquivado</small>':'')+'</td><td>'+esc(r[4])+'</td>'+r[5].map(v=>'<td class="num">'+num(v)+'</td>').join('')+'<td class="num">'+money(r[6].reduce((s,v)=>s+v,0))+'</td></tr>').join('')+'</tbody></table>'+(rows.length>250?'<p>Exibindo 250 itens; use os filtros para consultar os demais.</p>':'');
  }
  details.addEventListener('toggle',draw);select.addEventListener('change',draw);search.addEventListener('input',draw);area.prepend(box);
 }
 mount(document.getElementById('view-baixas'),'');mount(document.querySelector('#sj-pilot-root .sj-wrap'),'ALMOXARIFADO GERAL F SJ');
 // Eliminate stale annual-exclusion notices: dated 2026 months now exist for those items.
 const quality=document.getElementById('minimumFilterQuality');
 if(quality){const update=()=>{if(quality.textContent.includes('não entram no cálculo anual'))quality.textContent='Revisão 15/10: julho em diante está datado; o histórico antigo sem ano permanece arquivado. Consulte as fontes de cada item.'};const observer=new MutationObserver(update);observer.observe(quality,{childList:true,subtree:true});update()}
})();
