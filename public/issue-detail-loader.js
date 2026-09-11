// Carrega a base compactada de baixas detalhadas.
(async function(){
  if(window.ISSUE_DETAIL)return;
  const b64=window.ISSUE_DETAIL_B64||'';
  if(!b64)return;
  try{
    const bin=atob(b64),bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    if(typeof DecompressionStream!=='function')throw new Error('DecompressionStream indisponível');
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const text=await new Response(stream).text();
    window.ISSUE_DETAIL=JSON.parse(text);
    window.ISSUE_DETAIL_B64='';
    window.dispatchEvent(new Event('issue-detail-ready'));
  }catch(err){console.error('Falha ao carregar base detalhada de baixas',err)}
})();
