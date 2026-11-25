import { expect, test } from '@playwright/test';

// Phase 0 smoke test — hits the real anonymous (read-only, non-mutating)
// Gist endpoint on purpose, the same way a view-only visitor would. Once
// admin write flows exist, those tests must mock api.github.com instead
// (see README's full-file-PATCH warning) — never let a test write to the
// production Gist.
test('loads the app shell and real Gist data with no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Weight Tracker V2' })).toBeVisible();
  await expect(page.getByText('Weight entries')).toBeVisible();

  // Goal (lbs) row should render a number once the Gist loads.
  const goalRow = page.getByText('Goal (lbs)').locator('xpath=following-sibling::dd[1]');
  await expect(goalRow).not.toHaveText('', { timeout: 10_000 });

  expect(errors).toEqual([]);
});
