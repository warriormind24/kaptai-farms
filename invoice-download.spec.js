const { test, expect } = require('@playwright/test');

test('invoice form downloads a document', async ({ page }) => {
  await page.goto('file:///c:/Users/dominic.tembo/Desktop/Kaptai%20farms/index.html');
  await page.locator('#customer-name').fill('Jane Smith');
  await page.locator('#customer-contact').fill('jane@example.com');
  await page.locator('#document-form .price-input').fill('25.00');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#document-form button[type="submit"]').click();

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('inv-');
});
