import { expect, test } from '@playwright/test';
import sample from '../fixtures/weight-data.sample.json' with { type: 'json' };

// Phase 2 — admin auth + the first real Gist write flow. Unlike smoke.spec.ts,
// this NEVER hits the real production Gist for writes (or even reads, for the
// authenticated path): every request to api.github.com is intercepted and
// served from the local fixture. Only the view-only WeightChart stats come
// from the real anonymous Gist endpoint, same as every other test here — this
// test never asserts on those, only on the admin-only controls layered on top.

const GIST_FILE = 'weight-data.json';

test('logs in with a PAT verified against (a mocked) gist, edits the Goal, and the write round-trips through the retry-guarded patch', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  let currentFixture: Record<string, unknown> = { ...sample };
  let patchedBody: { files: Record<string, { content: string }> } | null = null;

  await page.route('https://api.github.com/gists/**', async (route) => {
    const request = route.request();
    if (request.method() === 'PATCH') {
      patchedBody = JSON.parse(request.postData() ?? '{}');
      const content = patchedBody.files[GIST_FILE].content;
      currentFixture = JSON.parse(content);
      await route.fulfill({ status: 200, body: '{}' });
      return;
    }
    // GET — the authenticated read used both to verify login and to re-fetch
    // before patching (writeGist's race-avoidance retry).
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(currentFixture) } } }),
    });
  });

  await page.goto('./');
  await expect(page.getByText('CURRENT')).toBeVisible();

  await page.getByRole('button', { name: 'Admin Login' }).click();
  await page.getByPlaceholder('Personal Access Token').fill('ghp_fake_token_for_test');
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible({ timeout: 10_000 });

  // The admin-only Goal editor appears once isAdmin flips true.
  const goalButton = page.getByRole('button', { name: /\d+ lbs/ });
  await expect(goalButton).toBeVisible();
  const initialGoalText = await goalButton.textContent();
  await goalButton.click();

  const goalInput = page.locator('input[type="number"]').first();
  await goalInput.fill('180');
  await page.getByRole('button', { name: 'Save goal' }).click();

  // The write's own onSuccess pushes the result straight into the display
  // cache, so this should update without any further network round trip.
  await expect(page.getByRole('button', { name: '180 lbs' })).toBeVisible({ timeout: 10_000 });
  expect(await goalButton.textContent()).not.toBe(initialGoalText);

  expect(patchedBody).not.toBeNull();
  expect((currentFixture as { goalLbs: number }).goalLbs).toBe(180);

  expect(errors).toEqual([]);
});

test('edits the injection schedule through the modal and the write round-trips through the retry-guarded patch', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  let currentFixture: Record<string, unknown> = { ...sample, injSchedule: [{ day: 0, ampm: 'am' }] };
  let patchedBody: { files: Record<string, { content: string }> } | null = null;

  await page.route('https://api.github.com/gists/**', async (route) => {
    const request = route.request();
    if (request.method() === 'PATCH') {
      patchedBody = JSON.parse(request.postData() ?? '{}');
      currentFixture = JSON.parse(patchedBody.files[GIST_FILE].content);
      await route.fulfill({ status: 200, body: '{}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(currentFixture) } } }),
    });
  });
  // The schedule card reads from the anonymous endpoint (same one every
  // view-only chart uses) for display, so it must be mocked too — otherwise
  // the modal opens seeded with the real production schedule instead of this
  // fixture, making "which day got toggled on" non-deterministic.
  await page.route('https://gist.githubusercontent.com/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(currentFixture) });
  });

  await page.goto('./');
  await page.getByRole('button', { name: 'Admin Login' }).click();
  await page.getByPlaceholder('Personal Access Token').fill('ghp_fake_token_for_test');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible({ timeout: 10_000 });

  await page.getByRole('link', { name: 'Dosing' }).click();
  await expect(page.getByText('Injection Schedule')).toBeVisible();
  await page.getByRole('button', { name: 'Edit' }).click();

  await page.getByRole('button', { name: 'We', exact: true }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Injection Schedule').locator('..').getByText(/We/)).toBeVisible({ timeout: 10_000 });

  expect(patchedBody).not.toBeNull();
  const days = ((currentFixture as { injSchedule: { day: number }[] }).injSchedule ?? []).map((s) => s.day).sort();
  expect(days).toEqual([0, 3]);

  expect(errors).toEqual([]);
});

test('imports a CSV export and merges new weight/calorie/BP rows into the live Gist', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  let currentFixture: Record<string, unknown> = { ...sample };
  let patchedBody: { files: Record<string, { content: string }> } | null = null;

  await page.route('https://api.github.com/gists/**', async (route) => {
    const request = route.request();
    if (request.method() === 'PATCH') {
      patchedBody = JSON.parse(request.postData() ?? '{}');
      currentFixture = JSON.parse(patchedBody.files[GIST_FILE].content);
      await route.fulfill({ status: 200, body: '{}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(currentFixture) } } }),
    });
  });
  await page.route('https://gist.githubusercontent.com/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(currentFixture) });
  });

  await page.goto('./');
  await page.getByRole('button', { name: 'Admin Login' }).click();
  await page.getByPlaceholder('Personal Access Token').fill('ghp_fake_token_for_test');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible({ timeout: 10_000 });

  await expect(page.getByText('Apple Health CSV export')).toBeVisible();
  const [fileChooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Choose File' }).click()]);
  await fileChooser.setFiles('tests/fixtures/health-export.sample.csv');

  await expect(page.getByText(/Imported \d+ weight entr/)).toBeVisible({ timeout: 10_000 });

  expect(patchedBody).not.toBeNull();
  const merged = currentFixture as { entries: { date: string }[]; calories: { date: string }[]; bloodPressure: { date: string }[] };
  expect(merged.entries.some((e) => e.date === '2026-01-16')).toBe(true);
  expect(merged.calories.some((c) => c.date === '2026-01-16')).toBe(true);
  expect(merged.bloodPressure.some((b) => b.date === '2026-01-16')).toBe(true);
  // The original fixture's own rows (a different date) must survive the merge.
  expect(merged.entries.some((e) => e.date === sample.entries[0].date)).toBe(true);

  expect(errors).toEqual([]);
});

test('rejects an invalid token and shows an error without logging in', async ({ page }) => {
  await page.route('https://api.github.com/gists/**', async (route) => {
    await route.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"Bad credentials"}' });
  });

  await page.goto('./');
  await page.getByRole('button', { name: 'Admin Login' }).click();
  await page.getByPlaceholder('Personal Access Token').fill('ghp_bad');
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page.getByText(/401/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Log out' })).not.toBeVisible();
});
