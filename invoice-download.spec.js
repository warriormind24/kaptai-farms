const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const indexUrl = pathToFileURL(path.join(__dirname, 'index.html')).href;

test('invoice form downloads a PDF', async ({ page }, testInfo) => {
  await page.goto(indexUrl);
  await page.locator('#customer-name').fill('Jane Smith');
  await page.locator('#customer-contact').fill('jane@example.com');
  await page.locator('#document-form .price-input').fill('25.00');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#document-form button[type="submit"]').click();

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('inv-0001.pdf');
  const downloadedFile = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(downloadedFile);
  const fileContents = await fs.readFile(downloadedFile);
  expect(fileContents.subarray(0, 4).toString()).toBe('%PDF');
});
