// Small, dependency-free XLSX writer. Values stay typed; text is never a formula.
// DB_CREATE_XLSX({sheets:[{name,columns:[{header,type,width}],rows,autoFilter,freezeHeader}],createdAt})
// returns a Uint8Array. Dates accept dd/mm/yyyy, yyyy-mm-dd or a Date (UTC day).
(function(root){
  'use strict';
  const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const REL='http://schemas.openxmlformats.org/package/2006/relationships';
  const OFFICE='http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
  const TYPES=new Set(['text','number','currency','percent','date','integer']);
  const STYLE={text:0,number:2,currency:3,percent:4,date:5,integer:6};
  const DAY=86400000;
  const assert=(condition,message)=>{if(!condition)throw Error('Excel: '+message)};
  function clean(value){
    let result='';
    for(const c of String(value??'')){
      const n=c.codePointAt(0);
      if(n===9||n===10||n===13||(n>=32&&n<=0xD7FF)||(n>=0xE000&&n<=0xFFFD)||(n>=0x10000&&n<=0x10FFFF))result+=c;
    }
    return result;
  }
  const xml=value=>clean(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const documentXml=body=>'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+body;
  const columnName=index=>{
    let name='';
    for(let n=index+1;n>0;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;
    return name;
  };
  function dateSerial(value){
    let year,month,day;
    if(Object.prototype.toString.call(value)==='[object Date]'){
      if(!Number.isFinite(value.getTime()))return null;
      year=value.getUTCFullYear();month=value.getUTCMonth()+1;day=value.getUTCDate();
    }else if(typeof value==='string'){
      const iso=value.match(/^(\d{4})-(\d{2})-(\d{2})$/),br=value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if(iso)[year,month,day]=iso.slice(1).map(Number);
      else if(br)[day,month,year]=br.slice(1).map(Number);
      else return null;
    }else return null;
    if(year<1900||year>9999||month<1||month>12||day<1||day>31)return null;
    const stamp=Date.UTC(year,month-1,day),date=new Date(stamp);
    if(date.getUTCFullYear()!==year||date.getUTCMonth()+1!==month||date.getUTCDate()!==day)return null;
    // Excel's 1900 system includes the fictional 29/02/1900 after serial 59.
    return (stamp-Date.UTC(1899,11,31))/DAY+(stamp>=Date.UTC(1900,2,1)?1:0);
  }
  function cell(ref,value,type,style){
    const opening='<c r="'+ref+'" s="'+style+'"';
    if(value==null||value==='')return opening+'/>';
    if(type==='text'){
      const text=clean(value);assert(text.length<=32767,'texto excede o limite de uma célula');
      return opening+' t="inlineStr"><is><t xml:space="preserve">'+xml(text)+'</t></is></c>';
    }
    const number=type==='date'?dateSerial(value):typeof value==='number'&&Number.isFinite(value)?value:null;
    if(number==null)return opening+'/>';
    if(type==='integer')assert(Number.isSafeInteger(number),'contagem inteira inválida');
    return opening+'><v>'+number+'</v></c>';
  }
  function sheetXml(sheet){
    const last=columnName(sheet.columns.length-1)+(sheet.rows.length+1);
    const columns=sheet.columns.map((c,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+c.width+'" customWidth="1"/>').join('');
    const header='<row r="1" ht="30" customHeight="1">'+sheet.columns.map((c,i)=>cell(columnName(i)+'1',c.header,'text',1)).join('')+'</row>';
    const rows=sheet.rows.map((row,i)=>'<row r="'+(i+2)+'">'+sheet.columns.map((c,j)=>cell(columnName(j)+(i+2),row[j],c.type,STYLE[c.type])).join('')+'</row>').join('');
    const view=sheet.freezeHeader?'<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/>':'<selection activeCell="A1" sqref="A1"/>';
    return documentXml('<worksheet xmlns="'+NS+'"><dimension ref="A1:'+last+'"/><sheetViews><sheetView workbookViewId="0" showGridLines="0">'+view+'</sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>'+columns+'</cols><sheetData>'+header+rows+'</sheetData>'+
      (sheet.autoFilter?'<autoFilter ref="A1:'+last+'"/>':'')+
      '<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.25" footer="0.25"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>');
  }
  function stylesXml(){
    const formats=[[164,'#,##0.######'],[165,'"R$" #,##0.00####;[Red]-"R$" #,##0.00####'],[166,'0.0%;[Red]-0.0%'],[167,'dd/mm/yyyy']];
    const numberStyle=id=>'<xf numFmtId="'+id+'" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>';
    return documentXml('<styleSheet xmlns="'+NS+'"><numFmts count="4">'+formats.map(([id,format])=>'<numFmt numFmtId="'+id+'" formatCode="'+xml(format)+'"/>').join('')+'</numFmts>'+
      '<fonts count="2"><font><sz val="11"/><color rgb="FF243E30"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font></fonts>'+
      '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F5132"/><bgColor indexed="64"/></patternFill></fill></fills>'+
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
      '<cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf>'+
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>'+
      [164,165,166,167,3].map(numberStyle).join('')+'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
  }
  const crcTable=Uint32Array.from({length:256},(_,n)=>{
    let c=n;for(let bit=0;bit<8;bit++)c=c&1?0xEDB88320^(c>>>1):c>>>1;return c>>>0;
  });
  function crc32(bytes){let crc=0xFFFFFFFF;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xFFFFFFFF)>>>0}
  function zip(files,created){
    const encoder=new TextEncoder(),parts=[],directory=[];let offset=0;
    const year=Math.max(1980,Math.min(2107,created.getUTCFullYear()));
    const date=((year-1980)<<9)|((created.getUTCMonth()+1)<<5)|created.getUTCDate();
    const time=(created.getUTCHours()<<11)|(created.getUTCMinutes()<<5)|Math.floor(created.getUTCSeconds()/2);
    for(const file of files){
      const name=encoder.encode(file.name),bytes=encoder.encode(file.text),crc=crc32(bytes);
      assert(bytes.length<=0xFFFFFFFF&&offset<=0xFFFFFFFF,'arquivo excede o limite ZIP');
      const local=new Uint8Array(30+name.length),l=new DataView(local.buffer);
      l.setUint32(0,0x04034B50,true);l.setUint16(4,20,true);l.setUint16(6,0x0800,true);
      l.setUint16(10,time,true);l.setUint16(12,date,true);l.setUint32(14,crc,true);
      l.setUint32(18,bytes.length,true);l.setUint32(22,bytes.length,true);l.setUint16(26,name.length,true);local.set(name,30);
      const central=new Uint8Array(46+name.length),c=new DataView(central.buffer);
      c.setUint32(0,0x02014B50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);
      c.setUint16(12,time,true);c.setUint16(14,date,true);c.setUint32(16,crc,true);
      c.setUint32(20,bytes.length,true);c.setUint32(24,bytes.length,true);c.setUint16(28,name.length,true);
      c.setUint32(42,offset,true);central.set(name,46);
      parts.push(local,bytes);directory.push(central);offset+=local.length+bytes.length;
    }
    const directorySize=directory.reduce((n,bytes)=>n+bytes.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);
    assert(files.length<=65535&&offset+directorySize+22<=0xFFFFFFFF,'arquivo excede o limite ZIP');
    e.setUint32(0,0x06054B50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);
    e.setUint32(12,directorySize,true);e.setUint32(16,offset,true);
    const output=new Uint8Array(offset+directorySize+22);let cursor=0;
    for(const bytes of [...parts,...directory,end]){output.set(bytes,cursor);cursor+=bytes.length}
    return output;
  }
  root.DB_CREATE_XLSX=function(options){
    assert(Array.isArray(options?.sheets)&&options.sheets.length>0&&options.sheets.length<=255,'informe de 1 a 255 abas');
    const usedNames=new Set();
    const sheets=options.sheets.map((sheet,index)=>{
      const name=clean(clean(sheet.name||'Planilha '+(index+1)).replace(/[\[\]:*?/\\]/g,' ').replace(/^'+|'+$/g,'').trim().slice(0,31))||'Planilha '+(index+1);
      assert(!usedNames.has(name.toLocaleLowerCase('pt-BR')),'nomes de abas repetidos');usedNames.add(name.toLocaleLowerCase('pt-BR'));
      assert(Array.isArray(sheet.columns)&&sheet.columns.length>0&&sheet.columns.length<=16384,'colunas inválidas');
      assert(Array.isArray(sheet.rows)&&sheet.rows.length<=1048575,'quantidade de linhas inválida');
      const columns=sheet.columns.map(column=>{
        const type=column.type||'text';assert(TYPES.has(type),'tipo de coluna não suportado');
        const width=Number.isFinite(column.width)?Math.max(5,Math.min(255,column.width)):type==='text'?25:18;
        return {header:column.header??'',type,width};
      });
      for(const row of sheet.rows)assert(Array.isArray(row)&&row.length<=columns.length,'linha incompatível com as colunas');
      return {name,columns,rows:sheet.rows,autoFilter:sheet.autoFilter!==false,freezeHeader:sheet.freezeHeader!==false};
    });
    const created=new Date(options.createdAt??Date.now());assert(Number.isFinite(created.getTime()),'data de exportação inválida');
    const timestamp=created.toISOString(),files=[];
    files.push({name:'[Content_Types].xml',text:documentXml('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+[
      ['/xl/workbook.xml','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'],['/xl/styles.xml','application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml'],
      ['/docProps/core.xml','application/vnd.openxmlformats-package.core-properties+xml'],['/docProps/app.xml','application/vnd.openxmlformats-officedocument.extended-properties+xml'],
      ...sheets.map((_,i)=>['/xl/worksheets/sheet'+(i+1)+'.xml','application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'])
    ].map(([part,type])=>'<Override PartName="'+part+'" ContentType="'+type+'"/>').join('')+'</Types>')});
    files.push({name:'_rels/.rels',text:documentXml('<Relationships xmlns="'+REL+'"><Relationship Id="rId1" Type="'+OFFICE+'officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="'+OFFICE+'extended-properties" Target="docProps/app.xml"/></Relationships>')});
    files.push({name:'docProps/core.xml',text:documentXml('<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Dashboard de Almoxarifados</dc:creator><cp:lastModifiedBy>Dashboard de Almoxarifados</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">'+timestamp+'</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">'+timestamp+'</dcterms:modified></cp:coreProperties>')});
    files.push({name:'docProps/app.xml',text:documentXml('<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Dashboard de Almoxarifados</Application></Properties>')});
    files.push({name:'xl/workbook.xml',text:documentXml('<workbook xmlns="'+NS+'" xmlns:r="'+OFFICE.slice(0,-1)+'"><workbookPr date1904="0"/><bookViews><workbookView activeTab="0"/></bookViews><sheets>'+sheets.map((sheet,i)=>'<sheet name="'+xml(sheet.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>')});
    files.push({name:'xl/_rels/workbook.xml.rels',text:documentXml('<Relationships xmlns="'+REL+'">'+sheets.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="'+OFFICE+'worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'<Relationship Id="rId'+(sheets.length+1)+'" Type="'+OFFICE+'styles" Target="styles.xml"/></Relationships>')});
    files.push({name:'xl/styles.xml',text:stylesXml()});
    sheets.forEach((sheet,i)=>files.push({name:'xl/worksheets/sheet'+(i+1)+'.xml',text:sheetXml(sheet)}));
    return zip(files,created);
  };
})(typeof window==='object'?window:globalThis);
