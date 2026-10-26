import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
process.env.HIVEZ_PLAYWRIGHT_MODULE ||= new URL('../.audit/browser/node_modules/playwright/index.mjs', import.meta.url).href;
process.env.HIVEZ_TEST_ORIGIN ||= 'http://localhost:5174';
process.env.HIVEZ_TEST_OUTPUT ||= 'artifacts/social-actions';
const { seedDesignData, saveDoc, openAppSession, origin, project, output } = await import('../tests/browser/app-session.mjs');
const uid = await seedDesignData();
const postId = `all-surfaces-${Date.now()}`;
const caption = `Across every surface ${postId}`;
const authorId = `legacy-surface-${Date.now()}`;
await saveDoc(`users/${authorId}`, { uid: authorId, username: 'surfaceauthor', usernameLower: 'surfaceauthor', displayName: 'Surface Author', displayNameLower: 'surface author', photoURL: '/avatars/319cd5c2-5426-45ff-a2c8-700d41b25e97.jpg', profileCompleted: true });
// Deliberately omit modern privacy/visibility fields and store a stale ID.
await saveDoc(`posts/${postId}`, { id: 'stale-imported-id', uid: authorId, username: 'surfaceauthor', displayName: 'Surface Author', photoURL: '/avatars/319cd5c2-5426-45ff-a2c8-700d41b25e97.jpg', caption, category: 'waste', mediaUrl: '/auth/people-together.jpg', mediaType: 'image', likes: 0, comments: 0, shares: 0, createdAt: new Date() });
await saveDoc(`savedPosts/${uid}_${postId}`, { userId: uid, postId, postAuthorId: authorId, createdAt: new Date() });
await saveDoc(`reHives/${uid}_${postId}`, { userId: uid, postId, postAuthorId: authorId, createdAt: new Date() });
const session = await openAppSession({ width: 1440, height: 1000 });
const { page, browser, context, evidence } = session;
const results = [];
const dbBase = `http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents`;
async function read(path) { const r = await fetch(`${dbBase}/${path}`, { headers: { Authorization: 'Bearer owner' } }); return r.ok ? r.json() : null; }
async function stored(path, exists = true) { const end = Date.now() + 8000; while (Date.now() < end) { if (Boolean(await read(path)) === exists) return; await new Promise(r => setTimeout(r, 100)); } throw new Error(`Persistence failure: ${path}`); }
async function test(name, fn) { console.log('CHECK', name); await fn(); results.push({ name, status: 'passed' }); console.log('PASS', name); }
async function comment(card, message) {
  await card.getByRole('button', { name: 'Comments', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Replies', exact: true });
  await dialog.waitFor();
  await dialog.getByRole('textbox', { name: 'Write a reply', exact: true }).fill(message);
  await dialog.getByRole('button', { name: 'Send reply', exact: true }).click();
  await dialog.locator('article').getByText(message, { exact: true }).waitFor();
  await page.keyboard.press('Escape');
}
async function quickActions(card, label) {
  await card.waitFor();
  const url = page.url();
  await card.getByRole('button', { name: 'Like post', exact: true }).click();
  await card.getByRole('button', { name: 'Unlike post', exact: true }).waitFor();
  await stored(`posts/${postId}/likes/${uid}`);
  assert.equal(page.url(), url, 'Social control must not activate the tile link');
  await card.getByRole('button', { name: 'Unlike post', exact: true }).click();
  await stored(`posts/${postId}/likes/${uid}`, false);
  await comment(card, `Reply from ${label}`);
  await card.getByRole('button', { name: 'Remove ReHive', exact: true }).click();
  await stored(`reHives/${uid}_${postId}`, false);
  assert.ok(Number((await read(`posts/${postId}`)).fields.reHives.integerValue) >= 0, 'Legacy counters must not become negative');
  // Own ReHives tile disappears when undone; re-add from the full post in that case.
  if (label === 'own ReHives') {
    await page.goto(`${origin}/post/${postId}`);
    card = page.locator('.app-feed-card');
  }
  await card.getByRole('button', { name: 'ReHive post', exact: true }).click();
  await stored(`reHives/${uid}_${postId}`);
}
try {
  for (const [label, path] of [['feed', '/'], ['Hive', '/hive/waste'], ['saved posts', '/saved'], ['post detail', `/post/${postId}`]]) {
    await test(`${label}: all seven controls on a legacy photo post`, async () => {
      await page.goto(origin + path);
      const card = page.locator('.app-feed-card').filter({ hasText: caption });
      await quickActions(card, label);
      await card.getByRole('button', { name: 'Remove from saved posts', exact: true }).waitFor();
      await card.getByRole('button', { name: 'Share post', exact: true }).click();
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await card.getByRole('button', { name: 'Copy link', exact: true }).click();
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `${origin}/post/${postId}`);
      await card.getByRole('button', { name: 'Send post via direct message', exact: true }).click();
      await page.getByRole('dialog', { name: 'Send post via direct message', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await card.getByRole('button', { name: /^(Volunteer|Joined|Manage)$/ }).click();
      await page.waitForURL(`${origin}/issue-community/issue_${postId}`);
      assert.ok(await read(`communityMembers/issue_${postId}_${uid}`));
    });
  }
  for (const [label, path, prepare, selector] of [
    ['profile Posts', `/profile?uid=${authorId}`, null, '.hv-profile-tile'],
    ['profile Media', `/profile?uid=${authorId}`, async () => page.getByRole('button', { name: 'Media', exact: true }).click(), '.hv-profile-tile'],
    ['own ReHives', '/profile', async () => page.getByRole('button', { name: 'ReHives', exact: true }).click(), '.hv-profile-tile'],
    ['Explore', '/search', null, 'article.group'],
    ['search results', '/search', async () => page.getByPlaceholder('Search people, posts, and hives').fill(postId), 'article'],
  ]) {
    await test(`${label}: real like, reply and ReHive buttons`, async () => {
      await page.goto(origin + path); if (prepare) await prepare();
      const card = label === 'Explore' ? page.locator(selector).filter({ has: page.getByAltText(caption) }) :
        page.locator(selector).filter({ has: page.getByRole('button', { name: new RegExp(label === 'search results' ? caption : `Open post by @surfaceauthor: ${caption}`) }) });
      await quickActions(card, label);
    });
  }
  await test('Mobile profile and Explore controls remain reachable without overflow', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of [`/profile?uid=${authorId}`, '/search']) {
      await page.goto(origin + path);
      const card = path.startsWith('/profile') ? page.locator('.hv-profile-tile').filter({ has: page.getByRole('button', { name: new RegExp(caption) }) }) : page.locator('article.group').filter({ has: page.getByAltText(caption) });
      await card.getByRole('button', { name: 'Like post', exact: true }).click();
      await card.getByRole('button', { name: 'Unlike post', exact: true }).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await page.screenshot({ path: `${output}/screenshots/mobile-explore-controls.png`, fullPage: true });
  });
  await test('Deleted detail clears the post and its toolbar', async () => {
    await page.goto(`${origin}/post/${postId}`); await page.locator('.app-feed-card').waitFor();
    await fetch(`${dbBase}/posts/${postId}`, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });
    await page.getByRole('heading', { name: 'Post unavailable' }).waitFor();
    assert.equal(await page.locator('.hv-post-actions').count(), 0);
  });
  assert.deepEqual(evidence.errors, [], 'Browser exceptions');
  assert.deepEqual(evidence.console, [], 'Browser console errors/warnings');
} catch (error) {
  results.push({ name: 'Failure', status: 'failed', error: error.message });
  await page.screenshot({ path: `${output}/screenshots/surfaces-failure.png`, fullPage: true });
  throw error;
} finally {
  await fs.writeFile(`${output}/surfaces-results.json`, JSON.stringify({ project, postId, realRepositoryRules: true, results, evidence }, null, 2));
  await browser.close();
}
