import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
process.env.HIVEZ_PLAYWRIGHT_MODULE ||= new URL('../.audit/browser/node_modules/playwright/index.mjs', import.meta.url).href;
process.env.HIVEZ_TEST_ORIGIN ||= 'http://localhost:5174';
process.env.HIVEZ_TEST_OUTPUT ||= 'artifacts/social-actions';
const { seedDesignData, saveDoc, openAppSession, origin, project, output } = await import('../tests/browser/app-session.mjs');
const uid=await seedDesignData();
const recipientId=`social-recipient-${Date.now()}`;
const recipientName=`Taylor ${Date.now()}`;
const recipientUsername=`taylor${Date.now()}`;
await saveDoc(`users/${recipientId}`,{uid:recipientId,username:recipientUsername,usernameLower:recipientUsername,displayName:recipientName,displayNameLower:recipientName.toLowerCase(),photoURL:'/avatars/569bdb7b-c5d4-4db9-a086-3825c01a10a9.jpg',profileCompleted:true,isPrivate:false,accountPrivacy:'public',privacy:{account:'public',messages:'everyone',mentions:'everyone',comments:'everyone',discoverable:true}});
const postId=`social-action-${Date.now()}`;
const caption=`Local test: neighbours planning a cleaner shared street. ${postId}`;
await saveDoc(`posts/${postId}`,{uid:'local-neighbour-one',displayName:'Sam Rivera',username:'samrivera',photoURL:'/avatars/319cd5c2-5426-45ff-a2c8-700d41b25e97.jpg',caption,mediaType:'text',mediaUrl:'',category:'waste',likes:2,comments:0,reHives:0,saves:0,shares:0,visibility:'public',createdAt:new Date()});
const session=await openAppSession({width:1440,height:1000});
const {browser,context,page,evidence}=session;
const results=[];
await fs.mkdir(`${output}/screenshots`,{recursive:true});
const dbUrl=`http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents`;
async function read(path) { const r=await fetch(`${dbUrl}/${path}`,{headers:{Authorization:'Bearer owner'}}); if(r.status===404)return null; assert.equal(r.ok,true,await r.clone().text()); return r.json(); }
async function documents(path) {return (await read(path))?.documents||[];}
async function waitForData(test,message) { const end=Date.now()+8000; while(Date.now()<end){if(await test())return;await new Promise(r=>setTimeout(r,150));}throw new Error(message);}
async function check(name,fn){console.log('CHECK',name);await fn();results.push({name,status:'passed'});console.log('PASS',name);}
async function home(){await page.goto(origin+'/');await card().waitFor();}
function card(){return page.locator('.app-feed-card').filter({hasText:caption});}
async function shot(name){await page.screenshot({path:`${output}/screenshots/${name}.png`,fullPage:true});}
try {
 await check('Like/unlike update the counter once and persist after reload',async()=>{
  await card().waitFor();
  await card().getByRole('button',{name:'Like post',exact:true}).click();
  await card().getByRole('button',{name:'Unlike post',exact:true}).waitFor();
  await waitForData(async()=>Boolean(await read(`posts/${postId}/likes/${uid}`)),'Like not stored');
  assert.equal((await read(`posts/${postId}`)).fields.likes.integerValue,'3');
  await page.reload(); await card().getByRole('button',{name:'Unlike post',exact:true}).waitFor();
  await card().getByRole('button',{name:'Unlike post',exact:true}).click();
  await waitForData(async()=>!(await read(`posts/${postId}/likes/${uid}`)),'Unlike not stored');
  assert.equal((await read(`posts/${postId}`)).fields.likes.integerValue,'2');
 });
 await check('Comments submit, reply in a thread, retain counts and delete own comments',async()=>{
  await card().getByRole('button',{name:'Comments',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Replies',exact:true});await dialog.waitFor();
  await dialog.getByRole('textbox',{name:'Write a reply',exact:true}).fill('We can help on Saturday.');
  await dialog.getByRole('button',{name:'Send reply',exact:true}).click();
  await dialog.locator('article').getByText('We can help on Saturday.',{exact:true}).waitFor();
  await waitForData(async()=>(await documents(`posts/${postId}/comments`)).length===1,'Comment not stored');
  const parent=(await documents(`posts/${postId}/comments`))[0];
  await dialog.getByRole('button',{name:'Reply to @alexlocal'}).click();
  await dialog.getByRole('textbox',{name:'Write a reply',exact:true}).fill('Bringing gloves too.');
  await dialog.getByRole('textbox',{name:'Write a reply',exact:true}).press('Enter');
  await dialog.locator('article').getByText('Bringing gloves too.',{exact:true}).waitFor();
  await waitForData(async()=>(await documents(`posts/${postId}/comments`)).length===2,'Reply not stored');
  const docs=await documents(`posts/${postId}/comments`);assert.equal(docs.length,2);assert.ok(docs.find(d=>d.fields.parentId?.stringValue===parent.name.split('/').pop()));
  assert.equal((await read(`posts/${postId}`)).fields.comments.integerValue,'2');
  await shot('comments-thread');
  const reply=dialog.locator('article').filter({hasText:'Bringing gloves too.'});
  await reply.getByRole('button',{name:'Comment options'}).click();
  await reply.getByRole('button',{name:'Delete',exact:true}).click();
  await waitForData(async()=>(await documents(`posts/${postId}/comments`)).length===1,'Reply not deleted');
  assert.equal((await read(`posts/${postId}`)).fields.comments.integerValue,'1');
  await page.keyboard.press('Escape');await home();
  assert.equal(await card().getByRole('button',{name:'Comments',exact:true}).innerText(),'1');
 });
 await check('ReHive is persistent, appears in the profile and can be undone',async()=>{
  await card().getByRole('button',{name:'ReHive post',exact:true}).click();
  await waitForData(async()=>Boolean(await read(`reHives/${uid}_${postId}`)),'ReHive not stored');
  assert.equal((await read(`posts/${postId}`)).fields.reHives.integerValue,'1');
  await page.goto(origin+'/profile'); await page.getByRole('button',{name:'ReHives',exact:true}).click();
  await page.getByRole('button',{name:new RegExp(caption.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).waitFor();
  await home();await card().getByRole('button',{name:'Remove ReHive',exact:true}).click();
  await waitForData(async()=>!(await read(`reHives/${uid}_${postId}`)),'ReHive not removed');
 });
 await check('Volunteer creates a missing issue community, joins it once and opens it',async()=>{
  await card().getByRole('button',{name:'Volunteer',exact:true}).click();
  await page.waitForURL(origin+`/issue-community/issue_${postId}`);
  assert.ok(await read(`communityMembers/issue_${postId}_${uid}`));
  assert.equal((await read(`issueCommunities/issue_${postId}`)).fields.memberCount.integerValue,'2');
  await home();await card().getByRole('button',{name:'Joined',exact:true}).click();
  await page.waitForURL(origin+`/issue-community/issue_${postId}`);
  assert.equal((await read(`issueCommunities/issue_${postId}`)).fields.memberCount.integerValue,'2');
  await home();
 });
 await check('Save appears in Saved Posts after reload and unsave removes it',async()=>{
  await card().getByRole('button',{name:'Save post',exact:true}).click();
  await waitForData(async()=>Boolean(await read(`savedPosts/${uid}_${postId}`)),'Save not stored');
  await page.goto(origin+'/saved');await card().waitFor();await page.reload();await card().getByRole('button',{name:'Remove from saved posts',exact:true}).click();
  await waitForData(async()=>!(await read(`savedPosts/${uid}_${postId}`)),'Save not removed');await home();
 });
 await check('Share copies a working post URL',async()=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await card().getByRole('button',{name:'Share post',exact:true}).click();
  await card().getByRole('button',{name:'Copy link',exact:true}).click();
  await page.getByText('Link copied',{exact:true}).first().waitFor();
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),origin+`/post/${postId}`);
  await page.goto(origin+`/post/${postId}`);await page.locator('.app-feed-card').getByText(caption,{exact:true}).waitFor();await home();
 });
 await check('DM send to a new conversation creates the message and shows a working shared-post preview',async()=>{
  await card().getByRole('button',{name:'Send post via direct message'}).click();
  const dialog=page.getByRole('dialog',{name:'Send post via direct message'});await dialog.waitFor();
  await dialog.getByPlaceholder('Search people...').fill(recipientUsername);
  await dialog.getByRole('button',{name:new RegExp(recipientName)}).click();
  await dialog.getByPlaceholder('Add a message...').fill('Can you help with this?');
  await dialog.getByRole('button',{name:'Send to 1',exact:true}).click();
  await page.getByText('Post sent',{exact:true}).waitFor();
  const chatId=[uid,recipientId].sort().join('_');
  const messages=await documents(`chats/${chatId}/messages`);assert.equal(messages.length,1);assert.equal(messages[0].fields.messageType.stringValue,'POST_SHARE');assert.equal(messages[0].fields.postId.stringValue,postId);
  assert.equal((await read(`chats/${chatId}`)).fields.unreadCounts.mapValue.fields[recipientId].integerValue,'1');
  await page.goto(origin+'/chats');await page.getByRole('button',{name:new RegExp(recipientName)}).first().click();
  await page.getByText('Can you help with this?',{exact:true}).waitFor();
  await shot('dm-shared-post');
  await page.getByRole('button',{name:new RegExp(caption)}).click();
  await page.waitForURL(origin+`/post/${postId}`);
  await page.locator('.app-feed-card').getByText(caption,{exact:true}).waitFor();
 });
 await check('Like/unlike another person’s comment without editing their comment document',async()=>{
  await saveDoc(`posts/${postId}/comments/neighbour-reply`,{uid:'local-neighbour-one',username:'samrivera',displayName:'Sam Rivera',photoURL:'/avatars/319cd5c2-5426-45ff-a2c8-700d41b25e97.jpg',text:'Thanks for lending a hand.',likes:0,parentId:null,depth:0,createdAt:new Date()});
  await home();await card().getByRole('button',{name:'Comments',exact:true}).click();
  const reply=page.getByRole('dialog',{name:'Replies',exact:true}).locator('article').filter({hasText:'Thanks for lending a hand.'});
  await reply.getByRole('button',{name:'Like comment',exact:true}).click();
  await waitForData(async()=>Boolean(await read(`posts/${postId}/comments/neighbour-reply/likes/${uid}`)),'Comment like not stored');
  await reply.getByRole('button',{name:'Unlike comment',exact:true}).waitFor();
  assert.equal(await reply.getByRole('button',{name:'Unlike comment',exact:true}).innerText(),'1');
  await reply.getByRole('button',{name:'Unlike comment',exact:true}).click();
  await waitForData(async()=>!(await read(`posts/${postId}/comments/neighbour-reply/likes/${uid}`)),'Comment unlike not stored');
  await page.keyboard.press('Escape');
 });
 assert.deepEqual(evidence.errors,[],'Unexpected browser exception');
 assert.deepEqual(evidence.console,[],'Unexpected console error or warning');
} catch(error){results.push({name:'Failure',status:'failed',error:error.message});await shot('failure');throw error;}
finally {await fs.writeFile(`${output}/results.json`,JSON.stringify({project,uid,postId,realRepositoryRules:true,results,evidence},null,2));await browser.close();}
