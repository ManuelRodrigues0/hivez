import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
process.env.HIVEZ_PLAYWRIGHT_MODULE ||= new URL('../.audit/browser/node_modules/playwright/index.mjs',import.meta.url).href;
process.env.HIVEZ_TEST_ORIGIN ||= 'http://localhost:5174';
process.env.HIVEZ_TEST_OUTPUT ||= 'artifacts/social-actions';
const {seedDesignData,saveDoc,openAppSession,origin,project,output}=await import('../tests/browser/app-session.mjs');
const uid=await seedDesignData();
const {browser,context,page,evidence}=await openAppSession({width:390,height:844});
const results=[];
const postId='local-cleanup';
function card(){return page.locator('.app-feed-card').filter({hasText:'A little care goes a long way.'});}
const dbUrl=`http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents`;
async function read(path){const r=await fetch(dbUrl+'/'+path,{headers:{Authorization:'Bearer owner'}});if(r.status===404)return null;return r.json();}
async function messages(person){const id=[uid,person].sort().join('_');return (await read(`chats/${id}/messages`))?.documents||[];}
async function messagePrivacy(value){const r=await fetch(`${dbUrl}/users/local-neighbour-two?updateMask.fieldPaths=privacy.messages`,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:{privacy:{mapValue:{fields:{messages:{stringValue:value}}}}}})});assert.equal(r.ok,true);}
async function commentsPrivacy(value){const r=await fetch(`${dbUrl}/users/local-neighbour-one?updateMask.fieldPaths=privacy.comments`,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:{privacy:{mapValue:{fields:{comments:{stringValue:value}}}}}})});assert.equal(r.ok,true);}
async function check(name,fn){console.log('CHECK',name);await fn();results.push({name,status:'passed'});console.log('PASS',name);}
async function screenshot(name){await page.screenshot({path:`${output}/screenshots/${name}.png`,fullPage:false});}
try {
 await check('Phone share menu stays on screen and Escape restores focus',async()=>{
  const share=card().getByRole('button',{name:'Share post',exact:true});await share.click();
  const menu=card().locator('.app-popover-menu');await menu.waitFor();const b=await menu.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=390);
  await screenshot('share-mobile');await page.keyboard.press('Escape');assert.equal(await menu.count(),0);assert.equal(await share.evaluate(e=>document.activeElement===e),true);
 });
 await check('Send dialog supports Escape and keyboard focus stays inside',async()=>{
  const send=card().getByRole('button',{name:'Send post via direct message'});await send.click();
  const dialog=page.getByRole('dialog',{name:'Send post via direct message'});await dialog.waitFor();
  assert.ok(await dialog.getByRole('button',{name:/Sam Rivera/}).count() <= 1);
  for(let i=0;i<9;i++){await page.keyboard.press('Tab');assert.equal(await dialog.evaluate(e=>e.contains(document.activeElement)),true);}
  await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);assert.equal(await send.evaluate(e=>document.activeElement===e),true);
 });
 await check('Partial DM failures retain only failed recipients and retry does not duplicate successful sends',async()=>{
  await messagePrivacy('nobody');
  const samBefore=(await messages('local-neighbour-one')).length;
  const jamieBefore=(await messages('local-neighbour-two')).length;
  await card().getByRole('button',{name:'Send post via direct message'}).click();
  const dialog=page.getByRole('dialog',{name:'Send post via direct message'});
  const search=dialog.getByRole('textbox',{name:'Search people to message'});
  await search.fill('sam');await dialog.getByRole('button',{name:/Sam Rivera/}).click();
  await search.fill('jamie');await dialog.getByRole('button',{name:/Jamie Chen/}).click();
  await dialog.getByRole('textbox',{name:'Add a message to the shared post'}).fill('Local test: can you help?');
  await dialog.getByRole('button',{name:'Send to 2',exact:true}).click();
  await dialog.getByRole('alert').waitFor();assert.match(await dialog.getByRole('alert').innerText(),/not accepting messages/);
  assert.equal((await messages('local-neighbour-one')).length,samBefore+1);
  assert.equal((await messages('local-neighbour-two')).length,jamieBefore);
  assert.equal(await dialog.getByRole('button',{name:'Send to 1',exact:true}).isEnabled(),true);
  await screenshot('dm-partial-failure');
  await messagePrivacy('everyone');
  await dialog.getByRole('button',{name:'Send to 1',exact:true}).click();
  await dialog.waitFor({state:'detached'});
  assert.equal((await messages('local-neighbour-one')).length,samBefore+1);
  assert.equal((await messages('local-neighbour-two')).length,jamieBefore+1);
 });
 await check('Native-share success, cancellation and copy fallback follow the expected contracts',async()=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  const url=origin+`/post/${postId}`;
  await page.evaluate(()=>{window.__shares=[];Object.defineProperty(navigator,'share',{configurable:true,value:async data=>window.__shares.push(data)});});
  await card().getByRole('button',{name:'Share post',exact:true}).click();await card().getByRole('button',{name:'Share',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.__shares[0].url),url);
  await page.evaluate(async()=>{await navigator.clipboard.writeText('cancel keeps clipboard');Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('Cancelled','AbortError');}});});
  await card().getByRole('button',{name:'Share post',exact:true}).click();await card().getByRole('button',{name:'Share',exact:true}).click();
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'cancel keeps clipboard');
  await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('Unavailable','NotAllowedError');}}));
  await card().getByRole('button',{name:'Share post',exact:true}).click();await card().getByRole('button',{name:'Share',exact:true}).click();
  await page.getByText('Share sheet unavailable. Link copied instead.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),url);
 });
 await check('Comment privacy errors preserve the draft and allow retry',async()=>{
  await commentsPrivacy('nobody');
  await card().getByRole('button',{name:'Comments',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Replies',exact:true});
  const input=dialog.getByRole('textbox',{name:'Write a reply',exact:true});
  const text=`Privacy retry check ${Date.now()}`;
  await input.fill(text);await dialog.getByRole('button',{name:'Send reply',exact:true}).click();
  await page.getByText('This author limits who can comment.',{exact:true}).waitFor();
  assert.equal(await input.inputValue(),text);
  await commentsPrivacy('everyone');
  await dialog.getByRole('button',{name:'Send reply',exact:true}).click();
  await dialog.locator('article').getByText(text,{exact:true}).waitFor();
  await page.keyboard.press('Escape');
 });
 await check('A private post cannot be sent to a recipient outside its audience',async()=>{
  const caption=`Private audience check ${Date.now()}`;
  await saveDoc(`posts/private-social-${Date.now()}`,{uid,username:'alexlocal',displayName:'Alex Morgan',photoURL:'/avatars/1958311d-8559-4a64-9203-dc3fb355a8d6.jpg',caption,visibility:'followers',category:'waste',mediaType:'text',mediaUrl:'',likes:0,comments:0,reHives:0,saves:0,shares:0,createdAt:new Date()});
  await page.goto(origin+'/');
  const privateCard=page.locator('.app-feed-card').filter({hasText:caption});await privateCard.waitFor();
  const before=(await messages('local-neighbour-two')).length;
  await privateCard.getByRole('button',{name:'Send post via direct message'}).click();
  const dialog=page.getByRole('dialog',{name:'Send post via direct message'});
  await dialog.getByRole('textbox',{name:'Search people to message'}).fill('jamie');await dialog.getByRole('button',{name:/Jamie Chen/}).click();
  await dialog.getByRole('button',{name:'Send to 1',exact:true}).click();
  await dialog.getByRole('alert').waitFor();assert.match(await dialog.getByRole('alert').innerText(),/cannot view this post/);
  assert.equal((await messages('local-neighbour-two')).length,before);
  await page.keyboard.press('Escape');
 });
 await check('Mobile action row has no horizontal overflow in either theme at 320px',async()=>{
  await page.setViewportSize({width:320,height:740});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await screenshot('actions-320-light');
  await page.getByRole('button',{name:'Switch to dark theme',exact:true}).filter({visible:true}).first().click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await screenshot('actions-320-dark');
 });
 assert.equal(evidence.errors.length,0,'Unexpected browser exception');
 assert.deepEqual(evidence.console.filter(entry=>!entry.text.startsWith('Failed to send comment: Error: This author limits who can comment.')),[],'Unexpected console error or warning');
} catch(error){results.push({name:'Failure',status:'failed',error:error.message});await screenshot('states-failure');throw error;}
finally{await messagePrivacy('everyone');await commentsPrivacy('everyone');await fs.writeFile(`${output}/states-results.json`,JSON.stringify({project,uid,postId,realRepositoryRules:true,results,fixtures:['Native Web Share API success/cancel/unavailable; real clipboard used'],evidence},null,2));await browser.close();}
