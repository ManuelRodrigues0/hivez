import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
process.env.HIVEZ_PLAYWRIGHT_MODULE ||= new URL('../.audit/browser/node_modules/playwright/index.mjs', import.meta.url).href;
process.env.HIVEZ_TEST_ORIGIN ||= 'http://localhost:5174';
process.env.HIVEZ_TEST_OUTPUT ||= 'artifacts/posting-redesign';
const { seedDesignData, openAppSession, origin, project, output } = await import('../tests/browser/app-session.mjs');
const uid = await seedDesignData();
const { browser, context, page, evidence } = await openAppSession({ width: 1440, height: 1000 });
const results = [];
const screenshots = `${output}/screenshots`;
await fs.mkdir(screenshots, { recursive: true });
async function capture(name) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${screenshots}/${name}.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false, `${name}: horizontal overflow`);
}
async function check(name, fn) { await fn(); results.push({ name, status: 'passed' }); console.log('PASS', name); }
async function docs() {
  const r = await fetch(`http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents/posts`);
  return (await r.json()).documents || [];
}
const caption = `Synthetic redesign test ${Date.now()}. Neighbours, who is up for a park clean-up?`;
const media = 'public/auth/shared-street.jpg';
let uploadRequests = 0;
// Only upload response and AI decision are fixtures. Auth, form validation and Firestore writes are real local emulators.
await context.route('https://api.cloudinary.com/**', async route => { uploadRequests++; await route.fulfill({ json: { secure_url: `${origin}/auth/shared-street.jpg` } }); });
await context.route('**/src/services/teachableMachineService.ts', route => route.fulfill({ contentType: 'application/javascript', body: 'export async function verifyWithLocalModel() { return { available: false, predictions: [], reason: "Browser UI fixture: local model not exercised", status: "unavailable" }; }' }));
let decision = 'VERIFIED';
await context.route('**/api/verify-report', route => route.fulfill({ json: { ok: true, finalDecision: decision, verificationScore: .94, agreement: 1, providers: [], verifiedAt: new Date().toISOString(), consensus: { finalDecision: decision, verificationScore: .94, agreement: 1, successfulChecks: 2, independentGroups: 2, relevantCount: decision === 'VERIFIED' ? 2 : 0, notRelevantCount: decision === 'VERIFIED' ? 0 : 2, issueDetectedCount: 2, strongContradiction: false, earlyConsensusReached: true, reason: 'Deterministic browser UI fixture' } } }));
try {
  await check('Create entry and modal open with keyboard focus and close with Escape', async () => {
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByRole('dialog', { name: 'Start a little something local.' }).waitFor();
    await capture('create-modal-light');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.goto(origin + '/create');
    await page.getByRole('heading', { level: 1, name: 'Good things start with you.' }).waitFor();
    await capture('entry-light');
  });
  await check('Text compose, live preview, Hive and sensitive settings persist to emulator', async () => {
    await page.getByRole('button', { name: /Write a post/ }).click();
    assert.equal(await page.getByRole('button', { name: 'Share post', exact: true }).isDisabled(), true);
    await page.getByRole('textbox', { name: 'Post text', exact: true }).fill(caption);
    await page.getByLabel('Post to a Hive').selectOption('waste');
    await page.getByLabel('Add a place').fill('Neighbourhood park');
    await page.getByLabel('Sensitive content').check();
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    assert.equal(await page.locator('.dispatch-written-preview').innerText().then(t => t.includes(caption)), true);
    await capture('text-preview-light');
    await page.getByRole('button', { name: 'Keep writing' }).click();
    await capture('text-composer-light');
    await page.getByRole('button', { name: 'Share post', exact: true }).click();
    await page.waitForURL(origin + '/');
    const post = (await docs()).find(p => p.fields.caption?.stringValue === caption);
    assert.ok(post); assert.equal(post.fields.uid.stringValue, uid); assert.equal(post.fields.category.stringValue, 'waste'); assert.equal(post.fields.sensitive.booleanValue, true);
  });
  await check('Photo attachments validate, render and remove; media post persists using a fixture upload', async () => {
    await page.goto(origin + '/create');
    await page.getByRole('button', { name: /Write a post/ }).click();
    await page.locator('input[type=file]').setInputFiles(media);
    await page.getByRole('button', { name: 'Remove attachment 1' }).waitFor();
    await capture('photo-post-light');
    await page.getByRole('button', { name: 'Remove attachment 1' }).click();
    assert.equal(await page.locator('.dispatch-contact-sheet').count(), 0);
    await page.locator('input[type=file]').setInputFiles(media);
    await page.getByRole('button', { name: 'Remove attachment 1' }).waitFor();
    await page.getByRole('textbox', { name: 'Post text', exact: true }).fill(caption + ' with photo');
    await page.getByRole('button', { name: 'Share post', exact: true }).click();
    await page.waitForURL(origin + '/');
    const post = (await docs()).find(p => p.fields.caption?.stringValue === caption + ' with photo');
    assert.ok(post); assert.equal(post.fields.mediaType.stringValue, 'image'); assert.ok(post.fields.mediaUrl.stringValue); assert.equal(uploadRequests, 1);
  });
  await check('Photo report: search, validation, check, location, details, preview and submit', async () => {
    await page.goto(origin + '/create');
    await page.getByRole('button', { name: /Create a photo report/ }).click();
    await page.locator('.hv-hive-result').first().waitFor();
    await capture('report-hive-light');
    await page.getByRole('textbox', { name: 'Search a problem, a place, a Hive…' }).fill('waste');
    await page.locator('.hv-hive-result').first().click();
    await page.getByRole('heading', { name: 'Capture the garbage' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Check photo & continue' }).isDisabled(), true);
    await page.locator('input[type=file][capture]').setInputFiles('artifacts/api-audit/images/overflowing-bin.jpg');
    await page.locator('.dispatch-evidence-preview').waitFor();
    await capture('report-evidence-light');
    await page.getByRole('button', { name: 'Check photo & continue' }).click();
    await page.getByRole('heading', { name: 'Verified', exact: true }).waitFor();
    await capture('report-verification-light');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('textbox', { name: 'Report location', exact: true }).fill('Neighbourhood park');
    await capture('report-location-light');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByLabel('Tell us what you noticed.').fill(caption + ' report');
    await page.getByRole('button', { name: 'important', exact: true }).click();
    await capture('report-details-light');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await capture('report-preview-light');
    await page.getByRole('button', { name: 'Submit Report', exact: true }).click();
    await page.waitForURL(origin + '/');
    const post = (await docs()).find(p => p.fields.caption?.stringValue === caption + ' report');
    assert.ok(post); assert.equal(post.fields.postType.stringValue, 'photo_report'); assert.equal(post.fields.urgency.stringValue, 'important');
  });
  await check('Dark theme and mobile layouts at 390px and 320px; text remains editable', async () => {
    await page.goto(origin + '/create');
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await capture('entry-dark');
    await page.getByRole('button', { name: /Write a post/ }).click();
    await page.getByRole('textbox', { name: 'Post text', exact: true }).fill('A little local good.');
    await capture('text-dark');
    await page.setViewportSize({ width: 390, height: 844 });
    await capture('text-mobile-dark');
    await page.getByRole('button', { name: 'Back to previous step' }).click();
    await page.getByRole('button', { name: /Create a photo report/ }).click();
    await page.locator('.hv-hive-result').first().waitFor();
    await capture('report-mobile-dark');
    await page.setViewportSize({ width: 320, height: 740 });
    await capture('report-320-dark');
  });
} finally {
  await fs.writeFile(`${output}/browser-results.json`, JSON.stringify({ project, uid, results, uploadRequests, fixtures: ['Cloudinary upload response', 'local image model', 'cloud verification decision'], evidence }, null, 2));
  await browser.close();
}
