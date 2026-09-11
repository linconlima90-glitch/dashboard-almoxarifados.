// Carrega a posição atualizada de estoque de 11/09/2026 e aplica ao dashboard.
(async function(){
  if(window.__CURRENT_STOCK_20260911_LOADING)return;
  window.__CURRENT_STOCK_20260911_LOADING=true;
  try{
    const b64=window.CURRENT_STOCK_GZ||'';
    if(!b64)throw new Error('Base de estoque compactada não carregada');
    const bin=atob(b64),bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    if(typeof DecompressionStream!=='function')throw new Error('Navegador sem suporte a DecompressionStream');
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const text=await new Response(stream).text();
    const marker='window.CURRENT_STOCK_20260911=';
    const pos=text.indexOf(marker);
    if(pos<0)throw new Error('Formato da base de estoque inválido');
    let json=text.slice(pos+marker.length).trim();
    if(json.endsWith(';'))json=json.slice(0,-1);
    window.CURRENT_STOCK_20260911=JSON.parse(json);
    window.CURRENT_STOCK_GZ='';
    const script=document.createElement('script');
    script.src='/current-stock-apply-20260911.js?v=20260911-2';
    script.async=false;
    document.head.appendChild(script);
  }catch(err){console.error('Falha ao carregar estoque de 11/09/2026',err)}
})();
