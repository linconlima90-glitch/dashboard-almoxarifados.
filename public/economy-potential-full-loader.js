// Monta a base completa do potencial de economia a partir dos blocos compactados
(function(){
  async function decodeChunk(b64){
    const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
    if(typeof DecompressionStream!=='function')throw new Error('DecompressionStream indisponivel');
    const stream=new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text());
  }
  async function load(){
    const D=window.ECONOMY_POTENTIAL_DATA, chunks=window.ECONOMY_FULL_CHUNKS||[];
    if(!D||!chunks.length)return;
    try{
      const parts=await Promise.all(chunks.map(decodeChunk));
      D.rows=parts.flat().filter(r=>(Number(r?.[9])||0)>0).sort((a,b)=>(Number(b[9])||0)-(Number(a[9])||0));
      window.ECONOMY_FULL_READY=true;
      window.dispatchEvent(new CustomEvent('economy-full-data-ready',{detail:{count:D.rows.length}}));
    }catch(e){
      console.error('Falha ao carregar base completa de economia',e);
      window.dispatchEvent(new CustomEvent('economy-full-data-error',{detail:{message:String(e)}}));
    }
  }
  load();
})();
