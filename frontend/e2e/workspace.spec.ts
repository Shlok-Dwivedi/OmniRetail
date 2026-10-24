import { test, expect } from '@playwright/test';

test('overview filters, charts and workbook download', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sales performance' })).toBeVisible();
  await expect(page.locator('.revenue-chart svg')).toBeVisible();
  const original = await page.locator('.stat-accent>strong').textContent();
  await page.getByLabel('Market', { exact: true }).selectOption('France');
  await expect(page.locator('.stat-accent>strong')).not.toHaveText(original!);
  await page.getByRole('button', { name: '30 days', exact: true }).click();
  await expect(page.getByLabel('Start date')).toHaveValue('2025-06-30');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export report', exact: true }).click();
  expect((await downloaded).suggestedFilename()).toBe('OmniRetail-report.xlsx');
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page.getByLabel('Start date')).toHaveValue('');
  expect(errors).toEqual([]);
});

test('customer directory, filtering, pagination and spending estimate', async ({ page }) => {
  await page.goto('/customers');
  await expect(page.getByRole('heading', { name: 'Customer intelligence' })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(20);
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.locator('.pagination')).toContainText('2 / 3');
  await page.getByLabel('Search customers').fill('France');
  await expect(page.locator('tbody tr')).toHaveCount(16);
  await page.getByRole('tab', { name: 'Spend estimator' }).click();
  await page.getByRole('button', { name: 'Estimate spending' }).click();
  await expect(page.locator('.prediction-card')).toContainText('Estimated customer spend');
  await page.getByRole('tab', { name: 'Buying behavior' }).click();
  await expect(page.locator('.recharts-scatter')).not.toHaveCount(0);
});

test('forecast horizons and exploratory analysis', async ({ page }) => {
  await page.goto('/forecast');
  await expect(page.locator('.stat-accent')).toContainText('Next 30 days');
  await page.getByRole('button', { name: '7 days', exact: true }).click();
  await expect(page.locator('.stat-accent')).toContainText('Next 7 days');
  await expect(page.locator('.recharts-line')).not.toHaveCount(0);
  await page.getByRole('link', { name: 'Explore', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'How much do customers spend per order?' }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Relationships' }).click();
  await expect(page.locator('.heat-cell')).toHaveCount(25);
  await page.getByLabel('Correlation method').selectOption('spearman');
  await page.getByRole('tab', { name: 'Sales rhythms' }).click();
  await expect(page.getByRole('heading', { name: 'Weekly rhythm' })).toBeVisible();
});

test('mobile navigation, guide and narrow layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sales performance' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Workspace guide' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('link', { name: 'Customers', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Customer intelligence' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('validated import, failure recovery and new dataset persistence', async ({ page }) => {
  await page.goto('/reports');
  await expect(page.getByRole('heading', { name: 'Data & reports' })).toBeVisible();
  await page.getByLabel('Sales file').setInputFiles({
    name: 'invalid.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('wrong\n1\n'),
  });
  await page.getByRole('button', { name: 'Import & open workspace' }).click();
  await expect(page.getByRole('alert').first()).toContainText('Missing columns');
  const rows =
    'InvoiceNo,StockCode,Description,Quantity,InvoiceDate,UnitPrice,CustomerID,Country\n1001,MUG,Ceramic mug,2,2026-01-01,12.5,101,France\n1002,MUG,Ceramic mug,3,2026-01-02,12.5,102,France\n';
  await page
    .getByLabel('Sales file')
    .setInputFiles({ name: 'fresh-sales.csv', mimeType: 'text/csv', buffer: Buffer.from(rows) });
  await page.getByRole('button', { name: 'Import & open workspace' }).click();
  await expect(page.locator('.quality-top>strong')).toHaveText('2');
  await expect(page.locator('.panel-head')).toContainText(['fresh-sales.csv']);
  await page.reload();
  await expect(page.locator('.quality-top>strong')).toHaveText('2');
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.locator('.stat-accent>strong')).toHaveText('£63');
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Forecast 90d', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('at least 30');
});
