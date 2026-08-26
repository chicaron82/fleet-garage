import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
const root='/home/ronnie/Kitchen/fleet-garage/';
const env=Object.fromEntries(readFileSync(root+'.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const BASE='http://localhost:5174', state=root+'.verify/state-dizee.json';
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:390,height:1500},deviceScaleFactor:2,...(existsSync(state)?{storageState:state}:{})});
const p=await ctx.newPage(); const errs=[];
p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto(BASE,{waitUntil:'networkidle'});
if(await p.locator('input[type=password]').count()){
  await p.locator('input[type=text]').first().fill(env.VERIFY_EMPLOYEE_ID);
  await p.locator('input[type=password]').fill(env.VERIFY_PASSWORD);
  await p.locator('button[type=submit]').click();
  await p.waitForLoadState('networkidle'); await p.waitForTimeout(2000);
  await ctx.storageState({path:state});
}
// 1 — the scan overlay, where the typed-plate fallback lives
await p.goto(BASE,{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
const dlg = p.locator('div[role=dialog][aria-label="Scan a key tag"]');
if (!(await dlg.count())) {
  await p.locator('header button, [class*=md\\:hidden] button').filter({ hasText: '📷' }).first().click().catch(async () => {
    await p.getByRole('button',{name:/Scan/i}).first().click();
  });
}
await p.waitForTimeout(1500);
console.log('overlay open:', await dlg.count());
await p.screenshot({path:root+'.verify/tonight-manual-plate.png'});
console.log('SHOT manual-plate');
// 2 — a vehicle record card, where the odometer chip now lives
await p.goto(BASE,{waitUntil:'networkidle'}); await p.waitForTimeout(1800);
if(!(await p.getByPlaceholder(/Search unit/i).count())){
  await p.getByLabel('Toggle sidebar').click(); await p.waitForTimeout(1200);
  await p.locator('div.fixed.inset-y-0').getByText('Holds',{exact:true}).first().click();
  await p.waitForTimeout(1500);
}
await p.getByPlaceholder(/Search unit/i).fill('LUR489');
await p.waitForTimeout(1200);
const row=p.getByText('LUR489').first();
await row.click(); await p.waitForTimeout(1200);
// searching + tapping a row opens the confirm sheet first (HoldsView.handleOpenVehicle)
const yes = p.getByRole('button',{name:/Yes, open it/i});
if (await yes.count()) { await yes.click(); await p.waitForTimeout(2000); }
const odo=p.getByText(/Log odometer|tap to update/);
if(await odo.count()){ await odo.first().scrollIntoViewIfNeeded(); }
await p.waitForTimeout(400);
await p.screenshot({path:root+'.verify/tonight-record-odometer.png'});
console.log('SHOT record-odometer · odo affordance found:', await odo.count());
console.log('ERRORS',errs);
await b.close();
