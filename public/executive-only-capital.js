// Resumo Executivo enxuto: exibe somente "Onde está o capital em estoque"
(function(){
  if(document.documentElement.dataset.executiveOnlyCapital==='1')return;
  document.documentElement.dataset.executiveOnlyCapital='1';

  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
  const style=document.createElement('style');
  style.id='executive-only-capital-style';
  style.textContent=`
    #view-executivo.exec-only-capital{padding-top:0!important}
    #view-executivo.exec-only-capital>.board-hero,
    #view-executivo.exec-only-capital>.board-reading,
    #view-executivo.exec-only-capital>.board-kpis,
    #view-executivo.exec-only-capital>.board-decisions,
    #view-executivo.exec-only-capital>.board-method{display:none!important}
    #view-executivo.exec-only-capital>.board-grid{display:block!important;margin:0!important}
    #view-executivo.exec-only-capital>.board-grid>.board-panel{display:none!important}
    #view-executivo.exec-only-capital>.board-grid>.board-panel.exec-capital-keep{display:block!important;width:100%!important;max-width:none!important;margin:0!important}
    #view-executivo.exec-only-capital .exec-capital-keep{min-height:520px}
    #view-executivo.exec-only-capital .exec-capital-keep .capital-chart-scroll{min-height:430px}
    @media(max-width:760px){#view-executivo.exec-only-capital .exec-capital-keep{min-height:440px}}
  `;
  document.head.appendChild(style);

  function apply(){
    const view=document.getElementById('view-executivo');
    if(!view)return false;
    const panels=[...view.querySelectorAll('.board-panel')];
    const capital=panels.find(p=>norm(p.querySelector('.board-title h3')?.textContent)==='ONDE ESTA O CAPITAL EM ESTOQUE'||p.classList.contains('capital-hierarchy'));
    if(!capital)return false;

    view.classList.add('exec-only-capital');
    panels.forEach(p=>p.classList.toggle('exec-capital-keep',p===capital));

    const grid=capital.closest('.board-grid');
    if(grid){
      [...grid.children].forEach(el=>{
        if(el!==capital&&el.classList.contains('board-panel'))el.style.display='none';
      });
    }
    return true;
  }

  if(!apply()){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(apply()||tries>60)clearInterval(timer)},100);
  }

  const view=document.getElementById('view-executivo');
  if(view){
    const observer=new MutationObserver(()=>apply());
    observer.observe(view,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),8000);
  }
})();
