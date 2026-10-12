const { test, expect } = require('@playwright/test');

async function addProfile(page, name) {
  await page.getByRole('button', { name: 'Add profile', exact: true }).click();
  await page.getByLabel('Profile name').fill(name);
  await page.getByRole('button', { name: 'Create profile', exact: true }).click();
}

test('migrates legacy records and isolates entries across profiles and reloads', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('test-initialized')) {
      localStorage.setItem('randy_body_tracker_v1', JSON.stringify([{ date: '2026-10-01', weight: 72 }]));
      localStorage.setItem('test-initialized', 'yes');
    }
  });
  await page.goto('/');
  await expect(page.locator('#summary-grid')).toContainText('72');
  await addProfile(page, 'Alex');
  await expect(page.locator('#summary-grid')).toContainText('No measurements yet');
  await page.getByRole('button', { name: '+ Log Entry', exact: true }).click();
  await page.locator('#f-date').fill('2026-10-01');
  await page.locator('#f-weight').fill('85');
  await page.getByRole('button', { name: 'Save Entry', exact: true }).click();
  await expect(page.locator('#summary-grid')).toContainText('85');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Switch to Alex', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#profile-context')).toContainText('Alex');
  await expect(page.locator('#summary-grid')).toContainText('85');
  await page.getByRole('button', { name: 'Switch to Randy', exact: true }).click();
  await expect(page.locator('#summary-grid')).toContainText('72');
  await page.getByRole('button', { name: 'Switch to Alex', exact: true }).click();
  await page.getByText('History', { exact: true }).click();
  await page.locator('#history-tbody button').first().click();
  await page.locator('#e-weight').fill('84');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.locator('#history-tbody')).toContainText('84');
  page.on('dialog', dialog => dialog.accept());
  await page.locator('#history-tbody button').last().click();
  await expect(page.locator('#history-tbody')).toContainText('No entries');
  await page.getByRole('button', { name: 'Switch to Randy', exact: true }).click();
  await expect(page.locator('#history-tbody')).toContainText('72');
});

test('rejects blank and duplicate names, supports keyboard cancellation and mobile layout', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await addProfile(page, '   ');
  await expect(page.getByRole('dialog', { name: 'Add profile' })).toBeVisible();
  await page.getByLabel('Profile name').fill(' randy ');
  await page.getByRole('button', { name: 'Create profile' }).click();
  await expect(page.locator('#profile-error')).toContainText('already');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Add profile' })).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('CSV imports and exports belong only to the selected profile', async ({ page }) => {
  await page.goto('/');
  await addProfile(page, 'Alex');
  await page.locator('#csv-file-input').setInputFiles({ name: 'measurements.csv', mimeType: 'text/csv', buffer: Buffer.from('date,weight\n2026-10-02,90') });
  await expect(page.locator('#summary-grid')).toContainText('90');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('alex_body_tracker.csv');
  const stream = await download.createReadStream();
  let csv = '';
  for await (const chunk of stream) csv += chunk;
  expect(csv).toContain('2026-10-02,90');
  expect(csv).not.toContain('67.1');
  await page.getByRole('button', { name: 'Switch to Randy', exact: true }).click();
  await expect(page.locator('#summary-grid')).toContainText('67.1');
  await expect(page.locator('#summary-grid')).not.toContainText('90');
});

test('profile removal requires confirmation and protects the final profile', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Remove profile', exact: true })).toBeDisabled();
  await addProfile(page, 'Alex Morgan');
  await expect(page.getByRole('button', { name: 'Switch to Alex Morgan' })).toContainText('AM');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Remove profile', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Switch to Alex Morgan' })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Remove profile', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Switch to Alex Morgan' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Switch to Randy' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Remove profile', exact: true })).toBeDisabled();
});
