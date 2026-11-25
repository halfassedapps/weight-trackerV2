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
