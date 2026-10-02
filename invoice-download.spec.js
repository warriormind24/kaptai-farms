const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const indexUrl = pathToFileURL(path.join(__dirname, 'index.html')).href;

test('invoice form downloads a document', async ({ page }) => {
  await page.goto(indexUrl);
  await page.locator('#customer-name').fill('Jane Smith');
  await page.locator('#customer-contact').fill('jane@example.com');
  await page.locator('#document-form .price-input').fill('25.00');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#document-form button[type="submit"]').click();

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('inv-');
});

test('invoice form downloads directly even when file sharing is available', async ({ page }) => {
  await page.addInitScript(() => {
    window.shareCalled = false;
    Object.defineProperty(navigator, 'canShare', { value: () => true });
    Object.defineProperty(navigator, 'share', {
      value: async () => { window.shareCalled = true; },
    });
  });
  await page.goto(indexUrl);
  await page.locator('#customer-name').fill('Jane Smith');
  await page.locator('#customer-contact').fill('jane@example.com');
  await page.locator('#document-form .price-input').fill('25.00');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#document-form button[type="submit"]').click();

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('inv-0001.html');
  expect(await page.evaluate(() => window.shareCalled)).toBe(false);
});
