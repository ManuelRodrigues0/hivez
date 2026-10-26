import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
process.env.HIVEZ_PLAYWRIGHT_MODULE ||= new URL('../.audit/browser/node_modules/playwright/index.mjs', import.meta.url).href;
const { seedDesignData, saveDoc, project } = await import('../tests/browser/app-session.mjs');
const uid = await seedDesignData();
const login = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'design-test@example.invalid', password: 'Local-Design-Only-2026!', returnSecureToken: true }),
});
const { idToken } = await login.json();
assert.ok(idToken);
const base = `http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents`;
async function cleanFixtures() {
  for (const collection of ['posts', 'users', 'reHives', 'follows', 'blocks']) {
    const response = await fetch(`${base}/${collection}`, { headers: { Authorization: 'Bearer owner' } });
    for (const document of (await response.json()).documents || []) {
      const id = document.name.split('/').pop();
      if (id.includes('compat-')) await fetch(`${base}/${collection}/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });
    }
  }
}
await cleanFixtures();
const results = [];
async function request(path, options = {}, authenticated = true) {
  return fetch(`${base}/${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers, ...(authenticated ? { Authorization: `Bearer ${idToken}` } : {}) } });
}
async function check(name, path, expected, options, authenticated) {
  const response = await request(path, options, authenticated);
  assert.equal(response.status, expected, `${name}: ${await response.text()}`);
  results.push({ name, status: 'passed', httpStatus: expected });
  console.log('PASS', name);
}
const like = { method: 'PATCH', body: JSON.stringify({ fields: { userId: { stringValue: uid } } }) };
for (const [key, settings, restricted] of [
  ['missing', {}, false], ['old-public', { isPrivate: false }, false],
  ['null-privacy', { privacy: null }, false], ['partial-privacy', { privacy: { comments: 'everyone' } }, false],
  ['public-account', { accountPrivacy: 'public' }, false], ['nested-public', { privacy: { account: 'public' } }, false],
  ['old-private', { isPrivate: true }, true], ['legacy-private', { privateAccount: true }, true],
  ['private-account', { accountPrivacy: 'private' }, true], ['nested-private', { privacy: { account: 'private' } }, true],
]) {
  const author = `compat-${key}`;
  const postId = `compat-${key}`;
  await fetch(`${base}/posts/${postId}/likes/${uid}`, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });
  await saveDoc(`users/${author}`, { uid: author, username: author, displayName: 'Local compatibility fixture', photoURL: '/avatars/319cd5c2-5426-45ff-a2c8-700d41b25e97.jpg', ...settings });
  await saveDoc(`posts/${postId}`, { uid: author, caption: 'Local legacy compatibility fixture', likes: 0 });
  await check(`${key}: read`, `posts/${postId}`, restricted ? 403 : 200);
  await check(`${key}: like`, `posts/${postId}/likes/${uid}`, restricted ? 403 : 200, like);
  if (restricted) {
    await saveDoc(`follows/${uid}_${author}`, { followerId: uid, followingId: author });
    await check(`${key}: approved follower can read`, `posts/${postId}`, 200);
  }
}
await check('Unauthenticated read stays denied', 'posts/compat-missing', 403, {}, false);
await saveDoc('posts/compat-followers', { uid: 'compat-missing', visibility: 'followers' });
await check('Explicit follower-only post stays restricted', 'posts/compat-followers', 403);
await request(`posts/compat-missing/likes/${uid}`, { method: 'DELETE' });
await saveDoc(`blocks/${uid}_compat-missing`, { blockerId: uid, blockedId: 'compat-missing' });
await check('Block still prevents liking a public legacy post', `posts/compat-missing/likes/${uid}`, 403, like);
async function rehivesQuery(author) {
  return fetch(`${base}:runQuery`, { method: 'POST', headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'reHives' }], where: { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: author } } } } }) });
}
for (const [author, isPrivate, expected] of [['compat-public-profile', false, 200], ['compat-private-profile', true, 403]]) {
  await saveDoc(`users/${author}`, { uid: author, isPrivate });
  await saveDoc(`reHives/${author}_compat-missing`, { userId: author, postId: 'compat-missing', postAuthorId: 'compat-missing', createdAt: new Date() });
  assert.equal((await rehivesQuery(author)).status, expected);
  results.push({ name: `ReHive profile query: ${isPrivate ? 'private denied' : 'public allowed'}`, status: 'passed' });
}
await saveDoc(`follows/${uid}_compat-private-profile`, { followerId: uid, followingId: 'compat-private-profile' });
assert.equal((await rehivesQuery('compat-private-profile')).status, 200);
results.push({ name: 'ReHive profile query: approved follower allowed', status: 'passed' });
const fields = data => ({ method: 'PATCH', body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, { stringValue: value }])) }) });
const ownSession = `users/${uid}/sessions/compat-session`;
await check('Existing session permission: owner can create', ownSession, 200, fields({ uid, event: 'local-rule-test' }));
await check('Existing session permission: owner can read', ownSession, 200);
await check('Existing session permission: edits remain denied', ownSession, 403, fields({ uid, event: 'changed' }));
await check('Existing session permission: owner can delete', ownSession, 200, { method: 'DELETE' });
await saveDoc('users/local-neighbour-one/sessions/compat-session', { uid: 'local-neighbour-one' });
await check('Existing session permission: another user cannot read', 'users/local-neighbour-one/sessions/compat-session', 403);
await check('Existing session permission: another user cannot create', 'users/local-neighbour-one/sessions/compat-new', 403, fields({ uid: 'local-neighbour-one' }));
const ownToken = `users/${uid}/pushTokens/compat-token`;
await check('Existing push-token permission: owner can register', ownToken, 200, fields({ token: 'local-test-token' }));
await check('Existing push-token permission: owner can read', ownToken, 200);
await check('Existing push-token permission: owner can refresh', ownToken, 200, fields({ token: 'local-test-token-updated' }));
await check('Existing push-token permission: empty token rejected', ownToken, 403, fields({ token: '' }));
await check('Existing push-token permission: oversized token rejected', ownToken, 403, fields({ token: 'x'.repeat(4097) }));
await check('Existing push-token permission: owner can revoke', ownToken, 200, { method: 'DELETE' });
await saveDoc('users/local-neighbour-one/pushTokens/compat-token', { token: 'local-test-token' });
await check('Existing push-token permission: another user cannot read', 'users/local-neighbour-one/pushTokens/compat-token', 403);
await check('Existing push-token permission: another user cannot register', 'users/local-neighbour-one/pushTokens/compat-new', 403, fields({ token: 'local-test-token' }));
for (const path of ['users/local-neighbour-one/sessions/compat-session', 'users/local-neighbour-one/pushTokens/compat-token']) {
  await fetch(`${base}/${path}`, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });
}
await fs.mkdir('artifacts/social-actions', { recursive: true });
await fs.writeFile('artifacts/social-actions/compatibility-results.json', JSON.stringify({ project, rules: 'repository firestore.rules, emulator only', results }, null, 2));
// Leave the shared emulator clean for the browser scenarios. This endpoint is loopback-only.
await cleanFixtures();
