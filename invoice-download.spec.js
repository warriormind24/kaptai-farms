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

test('invoice form shares a downloadable file on devices that support file sharing', async ({ page }) => {
  await page.addInitScript(() => {
    window.sharedFiles = [];
    Object.defineProperty(navigator, 'canShare', { value: () => true });
    Object.defineProperty(navigator, 'share', {
      value: async ({ files }) => window.sharedFiles.push(...files),
    });
  });
  await page.goto(indexUrl);
  await page.locator('#customer-name').fill('Jane Smith');
  await page.locator('#customer-contact').fill('jane@example.com');
  await page.locator('#document-form .price-input').fill('25.00');
  await page.locator('#document-form button[type="submit"]').click();

  const sharedFile = await page.evaluate(async () => {
    const [file] = window.sharedFiles;
    return { name: file?.name, type: file?.type, contents: await file?.text() };
  });

  expect(sharedFile.name).toBe('inv-0001.html');
  expect(sharedFile.type).toBe('text/html');
  expect(sharedFile.contents).toContain('Jane Smith');
  expect(sharedFile.contents).toContain('25.00');
});
