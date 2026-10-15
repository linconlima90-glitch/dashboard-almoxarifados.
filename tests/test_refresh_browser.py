"""Verify revised dated periods, stock identity, two-month policy, and both routes."""
import functools,http.server,json,os,threading
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
results={}
with sync_playwright() as p:
 options={'headless':True,'args':['--no-sandbox']}
 if os.getenv('CHROMIUM_PATH'):options['executable_path']=os.getenv('CHROMIUM_PATH')
 browser=p.chromium.launch(**options)
 for name,route in [('management','/'),('saoJoao','/_fast-sao-joao/')]:
  page=browser.new_page(viewport={'width':1440,'height':1000});errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(f'http://127.0.0.1:{server.server_port}'+route,wait_until='load',timeout=120000)
  page.wait_for_function("window.DB_REFRESH_META&&document.documentElement.dataset.fastReady==='1'")
  result=page.evaluate("""() => {
   const d=DB_REFRESH_META,n=x=>Number(x)||0,c=x=>Math.round(x*100);
   const valid=MOVEMENTS.filter(x=>x.revision_counts);
   const monthly=[6,7,8,9].map(i=>({records:valid.reduce((s,x)=>s+n(x.revision_counts[i]),0),cost:valid.reduce((s,x)=>s+c(n(x.revision_costs[i])),0)/100}));
   const years=new Map(MOVEMENTS_YEARLY.map(x=>[x.year+'|'+x.codigo_local+'|'+x.codigo,x]));
   const exact=valid.every(x=>{const y=years.get('2026|'+x.codigo_local+'|'+x.codigo);return x.revision_counts.every(n=>n===0)||[6,7,8,9].every(i=>Math.abs(n(y?.months[i])-n(x.revision_months[i]))<1e-7)});
   const averages=valid.every(x=>Math.abs(n(x.avg)-n(x.complete_total)/n(x.complete_months))<1e-8);
   const pending=valid.filter(x=>x.history_before_july==='PENDING');
   const annual=minimumRowsForYear(minimumBaseRows(),'2026');
   const annualMeans=annual.every(x=>{const y=years.get('2026|'+x.codigo_local+'|'+x.codigo);const months=y?.months||Array(12).fill(0);const divisor=y?.history_before_july&&y.history_before_july!=='DATED'?3:9;return Math.abs(n(x.avg)-months.slice(0,9).reduce((s,v)=>s+n(v),0)/divisor)<1e-7});
   return {stockRows:STOCK.length,stockValue:STOCK.reduce((s,x)=>s+c(x.valor_estoque),0)/100,stockDate:CURRENT_STOCK_META.emissao,cementAbsent:STOCK.every(x=>x.codigo!==100234),uniqueStock:new Set(STOCK.map(x=>x.codigo_local+'|'+x.codigo)).size===STOCK.length,monthly,exact,averages,annualMeans,pending:pending.length,pendingNotDoubleCounted:pending.every(x=>Math.abs(x.total-x.revision_total)<1e-7&&x.complete_months===3),minimumMonths:STOCK_MINIMUM_MONTHS,minimumValid:valid.every(x=>Math.abs(x.minimum-x.avg*2)<1e-7),ti:STOCK.filter(x=>String(x.codigo_local)==='10150').reduce((s,x)=>s+c(x.valor_estoque),0)/100,sourceRecords:d.sourceMovementRecords,acceptedRecords:d.movementRecords,acceptedCost:d.movementCost,oldOctoberNotAdded:!window.__MOVEMENT_20261008_APPLIED,summaryBoxes:document.querySelectorAll('.revision-box').length};
  }""")
  assert result['stockRows']==4103,result
  assert result['stockValue']==2268242.36,result
  assert result['ti']==40256.27,result
  assert result['sourceRecords']==4227 and result['acceptedRecords']==4179,result
  assert result['acceptedCost']==312838.31,result
  assert sum(x['records'] for x in result['monthly'])==4179,result
  assert round(sum(x['cost'] for x in result['monthly']),2)==312838.31,result
  assert result['minimumMonths']==2 and result['pending']==353,result
  for flag in ['cementAbsent','uniqueStock','exact','averages','annualMeans','pendingNotDoubleCounted','minimumValid','oldOctoberNotAdded']:assert result[flag],(flag,result)
  if name=='management':page.locator('.tab[data-view="baixas"]').evaluate('(e)=>e.click()');box=page.locator('#view-baixas .revision-box')
  else:box=page.locator('#sj-pilot-root .revision-box');assert '15/10/2026' in page.locator('.sj-status').inner_text()
  box.locator('summary').click()
  expect(box.locator('.revision-totals table tbody tr')).to_have_count(4,timeout=10000)
  box.locator('input').fill('ROLAMENTO')
  expect(box.locator('.revision-scroll table tbody tr').first).to_be_visible()
  assert 'ROLAMENTO' in box.locator('.revision-scroll').inner_text()
  assert not errors,errors
  result['errors']=errors;results[name]=result;page.close()
 browser.close()
server.shutdown()
(root/'refresh-browser-report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2))
