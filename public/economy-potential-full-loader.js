// Monta a base completa do potencial de economia por blocos, indexando os itens por grupo
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

    D.rows=[];
    D.rowsByGroup=Object.create(null);
    window.ECONOMY_FULL_READY=false;
    let loaded=0;

    function addRows(part,index){
      const valid=(Array.isArray(part)?part:[]).filter(r=>(Number(r?.[9])||0)>0);
      if(!valid.length)return;
      D.rows.push(...valid);
      for(const row of valid){
        const group=String(row?.[2]||'');
        if(!D.rowsByGroup[group])D.rowsByGroup[group]=[];
        D.rowsByGroup[group].push(row);
      }
      loaded+=valid.length;
      window.dispatchEvent(new CustomEvent('economy-chunk-ready',{detail:{index,count:loaded}}));
    }

    try{
      await Promise.all(chunks.map(async(chunk,index)=>{
        const part=await decodeChunk(chunk);
        addRows(part,index);
      }));

      for(const rows of Object.values(D.rowsByGroup)){
        rows.sort((a,b)=>(Number(b[9])||0)-(Number(a[9])||0));
      }
      window.ECONOMY_FULL_READY=true;
      window.dispatchEvent(new CustomEvent('economy-full-data-ready',{detail:{count:D.rows.length}}));
    }catch(e){
      console.error('Falha ao carregar base completa de economia',e);
      window.dispatchEvent(new CustomEvent('economy-full-data-error',{detail:{message:String(e)}}));
    }
  }
  load();
})();
