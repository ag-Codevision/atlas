import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('http://127.0.0.1:4173');
  await page.waitForTimeout(1000);
  const enterBtn = await page.$('#enterAtlas');
  if (enterBtn && await enterBtn.isVisible()) await enterBtn.click();
  await page.waitForTimeout(1500);

  console.log('Abrindo Command Palette...');
  await page.keyboard.press('Control+KeyK');
  await page.waitForTimeout(800);

  console.log('Digitando busca: Paris...');
  await page.fill('#commandInput', 'Paris');
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'screenshot_search_palette.png' });
  console.log('Salvo screenshot_search_palette.png');

  console.log('Pressionando Enter no primeiro resultado...');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);

  await page.screenshot({ path: 'screenshot_after_search.png' });
  console.log('Salvo screenshot_after_search.png');

  await browser.close();
  console.log('Teste de busca concluído!');
})();
