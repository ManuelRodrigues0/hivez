import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
process.env.HIVEZ_PLAYWRIGHT_MODULE ||= new URL('../.audit/browser/node_modules/playwright/index.mjs', import.meta.url).href;
process.env.HIVEZ_TEST_ORIGIN ||= 'http://localhost:5174';
process.env.HIVEZ_TEST_OUTPUT ||= 'artifacts/posting-redesign';
const { seedDesignData, openAppSession, origin, output } = await import('../tests/browser/app-session.mjs');
await seedDesignData();
const { browser, context, page, evidence } = await openAppSession();
const results=[];
const screens=`${output}/states`;
await fs.mkdir(screens,{recursive:true});
async function check(name,fn) { await fn(); results.push({name,status:'passed'}); console.log('PASS',name); }
async function shot(name) { await page.screenshot({path:`${screens}/${name}.png`,fullPage:true}); assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name} overflow`); }
await context.route('**/src/services/teachableMachineService.ts',route=>route.fulfill({contentType:'application/javascript',body:'export async function verifyWithLocalModel() { return { available: false, predictions: [], reason: "UI fixture", status: "unavailable" }; }'}));
await context.route('**/api/verify-report',route=>route.fulfill({json:{ok:true,finalDecision:'REJECTED',verificationScore:.05,agreement:1,providers:[],verifiedAt:new Date().toISOString(),consensus:{finalDecision:'REJECTED',verificationScore:.05,agreement:1,successfulChecks:2,independentGroups:2,relevantCount:0,notRelevantCount:2,issueDetectedCount:0,strongContradiction:true,earlyConsensusReached:true,reason:'Deterministic rejection fixture'}}}));
const suggestion='A damaged bench near the park entrance needs repair.';
await context.route('**/api/omniroute-intel',async route=>{
  const request=route.request().postDataJSON();
  const json=request.op==='assistDescription'?{ok:true,suggestion,completenessHints:['Add when you noticed it.']}:{ok:true,meaningfulness:'MEANINGFUL_REPORTABLE_ISSUE',descriptionImageMatch:null,consistencyNote:null,existingHiveId:'roads',existingHiveConfidence:.9,proposal:null};
  await route.fulfill({json});
});
async function report() { await page.goto(origin+'/'); await page.goto(origin+'/create'); await page.getByRole('button',{name:/Create a photo report/}).click(); await page.locator('.hv-hive-result').first().waitFor(); }
try {
 await check('Optional evidence skips AI cleanly, returns to evidence, and validates details',async()=>{
  await report();
  await page.getByRole('button',{name:/Report another issue/}).click();
  await page.getByRole('button',{name:'Continue without a photo'}).click();
  await page.getByRole('heading',{name:'Where did this happen?'}).waitFor();
  await page.getByRole('button',{name:'Back to previous step'}).click();
  await page.getByRole('heading',{name:'Add evidence',exact:true}).waitFor();
  await page.getByRole('button',{name:'Continue without a photo'}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Preview',exact:true}).click();
  assert.match(await page.getByRole('alert').innerText(),/required report details/);
  assert.equal(await page.getByLabel('Tell us what you noticed.').evaluate(e=>document.activeElement===e),true);
 });
 await check('AI wording is optional; discard, edit and accept behave as labelled',async()=>{
  const description=page.getByLabel('Tell us what you noticed.');
  await description.fill('broken bench near park');
  await page.getByRole('button',{name:'Improve wording'}).click();
  await page.getByRole('button',{name:'Discard',exact:true}).waitFor();
  assert.equal(await description.inputValue(),'broken bench near park');
  await page.getByRole('button',{name:'Discard',exact:true}).click();
  assert.equal(await description.inputValue(),'broken bench near park');
  await page.getByRole('button',{name:'Improve wording'}).click();
  await page.getByRole('button',{name:'Edit',exact:true}).click();
  assert.equal(await description.inputValue(),suggestion);
  await description.fill('broken bench near park');
  await page.getByRole('button',{name:'Improve wording'}).click();
  await shot('wording-suggestion');
  await page.getByRole('button',{name:'Accept',exact:true}).click();
  assert.equal(await description.inputValue(),suggestion);
  await page.getByRole('button',{name:'Check for an existing Hive'}).click();
  await page.getByRole('button',{name:'Use this Hive'}).waitFor();
  assert.equal(await description.inputValue(),suggestion);
  await shot('hive-analysis');
 });
 await check('Image rejection keeps publishing gated; replace recovers; invalid uploads show an error',async()=>{
  await report();
  await page.getByRole('textbox',{name:'Search a problem, a place, a Hive…'}).fill('waste');
  await page.locator('.hv-hive-result').first().click();
  await page.locator('input[capture]').setInputFiles({name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('not an image')});
  await page.getByRole('alert').waitFor();
  assert.equal(await page.getByRole('button',{name:'Check photo & continue'}).isDisabled(),true);
  await page.locator('input[capture]').setInputFiles('artifacts/api-audit/images/overflowing-bin.jpg');
  await page.locator('.dispatch-evidence-preview').waitFor();
  await page.getByRole('button',{name:'Check photo & continue'}).click();
  await page.getByRole('heading',{name:'Image Does Not Match Category',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Continue',exact:true}).count(),0);
  await shot('rejected-image');
  await page.getByRole('button',{name:'Try Another Image'}).click();
  await page.getByRole('button',{name:'Replace',exact:true}).click();
  assert.equal(await page.locator('.dispatch-evidence-preview').count(),0);
  await page.locator('input[capture]').setInputFiles('artifacts/api-audit/images/overflowing-bin.jpg');
  await page.locator('.dispatch-evidence-preview').waitFor();
 });
 await check('Phone evidence, details and preview stay within the viewport; reduced motion is respected',async()=>{
  await page.setViewportSize({width:390,height:844});
  await shot('evidence-mobile-light');
  await page.getByRole('button',{name:'Back to previous step'}).click();
  await page.getByRole('button',{name:/Report another issue/}).click();
  await page.getByRole('button',{name:'Continue without a photo'}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByLabel('Tell us what you noticed.').fill('The bench by the park gate needs repair.');
  await page.getByLabel('What type of issue is this?').fill('Broken public bench');
  await shot('details-mobile-light');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('button',{name:'Preview',exact:true}).click();
  await page.getByRole('heading',{name:'Ready to put it out there?'}).waitFor();
  assert.equal(await page.locator('.dispatch-report-stage').evaluate(e=>getComputedStyle(e).animationName),'none');
  await shot('preview-mobile-light');
  await page.setViewportSize({width:320,height:740});
  await shot('preview-320-light');
  const unnamed=await page.locator('.hv-dispatch button').evaluateAll(es=>es.filter(e=>!e.innerText.trim()&&!e.getAttribute('aria-label')).length);
  assert.equal(unnamed,0);
  const unlabelled=await page.locator('.hv-dispatch input:not([type=file]),.hv-dispatch textarea,.hv-dispatch select').evaluateAll(es=>es.filter(e=>!e.labels?.length&&!e.getAttribute('aria-label')).length);
  assert.equal(unlabelled,0);
 });
} finally {
 await fs.writeFile(`${output}/states-results.json`,JSON.stringify({results,fixtures:['Local image model','Rejected cloud check','OmniRoute wording and Hive analysis'],evidence},null,2));
 await browser.close();
}
