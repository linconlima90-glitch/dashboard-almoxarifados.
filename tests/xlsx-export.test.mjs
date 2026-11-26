import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const context=vm.createContext({window:{},TextEncoder,Date,Uint8Array,Uint32Array,DataView});
vm.runInContext(fs.readFileSync(path.join(root,'public/xlsx-export.js'),'utf8'),context);
const create=context.window.DB_CREATE_XLSX;
const createdAt=new Date('2030-01-02T03:04:06Z');

// Python's standard ZIP/XML readers check the container independently of the JS writer.
function inspect(bytes,t){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'dashboard-xlsx-test-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const file=path.join(directory,'synthetic.xlsx');fs.writeFileSync(file,bytes);
  const script=String.raw`
import json,sys,zipfile,xml.etree.ElementTree as E
with zipfile.ZipFile(sys.argv[1]) as z:
    assert z.testzip() is None, 'ZIP CRC failed'
    documents={n:E.fromstring(z.read(n)) for n in z.namelist() if n.endswith(('.xml','.rels'))}
    ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    workbook=documents['xl/workbook.xml']
    names=[x.attrib['name'] for x in workbook.findall('s:sheets/s:sheet',ns)]
    styles=documents['xl/styles.xml']
    formats={x.attrib['numFmtId']:x.attrib['formatCode'] for x in styles.findall('s:numFmts/s:numFmt',ns)}
    xfs=[x.attrib['numFmtId'] for x in styles.findall('s:cellXfs/s:xf',ns)]
    sheets=[]
    for i,name in enumerate(names):
        sheet=documents['xl/worksheets/sheet'+str(i+1)+'.xml']
        cells={}
        for c in sheet.findall('s:sheetData/s:row/s:c',ns):
            v=c.find('s:v',ns)
            text=''.join(c.itertext()) if c.attrib.get('t')=='inlineStr' else None
            cells[c.attrib['r']]={'type':c.attrib.get('t'),'value':text if text is not None else v.text if v is not None else None,'style':c.attrib['s']}
        pane=sheet.find('s:sheetViews/s:sheetView/s:pane',ns)
        filters=sheet.find('s:autoFilter',ns)
        sheets.append({'name':name,'cells':cells,'pane':None if pane is None else pane.attrib,'filter':None if filters is None else filters.attrib['ref'],'rowCount':len(sheet.findall('s:sheetData/s:row',ns)),'formulaCount':len(sheet.findall('.//s:f',ns))})
    assert all(n.startswith(('xl/','docProps/','_rels/')) or n=='[Content_Types].xml' for n in z.namelist())
    print(json.dumps({'files':z.namelist(),'names':names,'sheets':sheets,'formats':formats,'xfs':xfs,'headerFill':styles.find('s:fills/s:fill[3]/s:patternFill/s:fgColor',ns).attrib['rgb']},ensure_ascii=False))
`;
  const result=spawnSync('python3',['-c',script,file],{encoding:'utf8',maxBuffer:10*1024*1024});
  assert.equal(result.status,0,result.stderr||result.error?.message);
  return JSON.parse(result.stdout);
}

test('XLSX preserves numeric precision, dates, Unicode and formula-like text with native filters and styles',t=>{
  const source={createdAt,sheets:[{name:'Variação de compras',columns:[
    {header:'Código',type:'text',width:14},{header:'Produto',type:'text',width:42},
    {header:'Preço',type:'currency'},{header:'Variação',type:'percent'},
    {header:'Data',type:'date'},{header:'Compras',type:'integer'},
    {header:'Quantidade',type:'number'}
  ],rows:[
    ['0007','=1+1',12.345678,0.375,'26/11/2026',3,0.125],
    ['0008','Árvore & <parafuso> "A" 💧\u0000',-4.25,-0.5,'2026-11-27',2,10],
    ['0009','@texto',NaN,Infinity,'31/02/2026',0,null]
  ]},{name:'Filtros',autoFilter:false,freezeHeader:false,columns:[{header:'Filtro',type:'text'},{header:'Seleção',type:'text'}],rows:[['Fornecedor','A & B'],['Pesquisa','=texto literal']]}]};
  const snapshot=structuredClone(source),book=inspect(create(source),t),sheet=book.sheets[0];
  assert.deepEqual(source,snapshot,'export does not mutate input data');
  assert.deepEqual(book.names,['Variação de compras','Filtros']);
  assert.equal(sheet.cells.A2.value,'0007');assert.equal(sheet.cells.A2.type,'inlineStr');
  assert.equal(sheet.cells.B2.value,'=1+1');assert.equal(sheet.cells.B2.type,'inlineStr');
  assert.equal(sheet.cells.B3.value,'Árvore & <parafuso> "A" 💧');
  assert.equal(sheet.formulaCount,0);assert.equal(book.sheets[1].formulaCount,0);
  assert.equal(Number(sheet.cells.C2.value),12.345678);assert.equal(sheet.cells.C2.type,null);
  assert.equal(Number(sheet.cells.D2.value),0.375);assert.equal(Number(sheet.cells.G2.value),0.125);
  assert.equal(Number(sheet.cells.E2.value),(Date.UTC(2026,10,26)-Date.UTC(1899,11,30))/86400000);
  assert.equal(Number(sheet.cells.E3.value),(Date.UTC(2026,10,27)-Date.UTC(1899,11,30))/86400000);
  assert.equal(Number(sheet.cells.C3.value),-4.25);
  for(const key of ['C4','D4','E4','G4'])assert.equal(sheet.cells[key].value,null);
  assert.equal(sheet.filter,'A1:G4');assert.equal(sheet.pane.state,'frozen');assert.equal(sheet.pane.topLeftCell,'A2');
  assert.equal(book.sheets[1].filter,null);assert.equal(book.sheets[1].pane,null);
  assert.equal(book.headerFill,'FF0F5132');
  assert.match(book.formats[book.xfs[Number(sheet.cells.C2.style)]],/R\$/);
  assert.match(book.formats[book.xfs[Number(sheet.cells.D2.style)]],/%/);
  assert.equal(book.formats[book.xfs[Number(sheet.cells.E2.style)]],'dd/mm/yyyy');
});

test('all rows are exported without pagination and Excel dates retain the 1900 calendar boundary',t=>{
  const rows=Array.from({length:1205},(_,i)=>['Item '+i,i+1]);
  const book=inspect(create({createdAt,sheets:[
    {name:'Todos',columns:[{header:'Produto',type:'text'},{header:'Compras',type:'integer'}],rows},
    {name:'Datas',columns:[{header:'Data',type:'date'}],rows:[['1900-01-01'],['28/02/1900'],['1900-03-01'],['1900-02-29'],[new Date(Date.UTC(2028,1,29))]]},
    {name:'Vazio',columns:[{header:'Produto',type:'text'}],rows:[]}
  ]}),t);
  assert.equal(book.sheets[0].rowCount,1206);
  assert.equal(book.sheets[0].cells.A1206.value,'Item 1204');assert.equal(Number(book.sheets[0].cells.B1206.value),1205);
  assert.equal(book.sheets[0].filter,'A1:B1206');
  const dates=book.sheets[1].cells;
  assert.equal(Number(dates.A2.value),1);assert.equal(Number(dates.A3.value),59);assert.equal(Number(dates.A4.value),61);
  assert.equal(dates.A5.value,null);assert.equal(Number(dates.A6.value),(Date.UTC(2028,1,29)-Date.UTC(1899,11,30))/86400000);
  assert.equal(book.sheets[2].rowCount,1);assert.equal(book.sheets[2].filter,'A1:A1');
});

test('invalid workbook shapes stop export instead of silently dropping columns or numeric counts',()=>{
  assert.throws(()=>create({sheets:[]}),/abas/);
  assert.throws(()=>create({sheets:[{name:'A',columns:[{header:'Código'}],rows:[['one','extra']]}]}),/linha incompatível/);
  assert.throws(()=>create({sheets:[{name:'A',columns:[{header:'Compras',type:'integer'}],rows:[[1.5]]}]}),/contagem inteira/);
  assert.throws(()=>create({sheets:[{name:'A',columns:[{header:'Nome'}],rows:[]},{name:'a',columns:[{header:'Nome'}],rows:[]}]}),/nomes de abas/);
});
