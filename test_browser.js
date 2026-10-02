import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('http://127.0.0.1:4173');
  await page.waitForTimeout(1000);

  const enterBtn = await page.$('#enterAtlas');
  if (enterBtn && await enterBtn.isVisible()) {
    await enterBtn.click();
  }
  await page.waitForTimeout(2000);

  // 1. Testa viajar para São Paulo pelo carrossel
  console.log('Viajando para São Paulo...');
  const spBtn = await page.$('[data-city="sao-paulo"]');
  if (spBtn) {
    await spBtn.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'screenshot_sao_paulo.png' });
    console.log('Salvo screenshot_sao_paulo.png');
  }

  // 2. Testa LISTEN + WATCH
  console.log('Testando LISTEN + WATCH...');
  const lwBtn = await page.$('#listenWatchMain');
  if (lwBtn) {
    await lwBtn.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'screenshot_listen_watch.png' });
    console.log('Salvo screenshot_listen_watch.png');
  }

  // 3. Minimizar câmera para floating player
  console.log('Minimizando câmera...');
  const miniBtn = await page.$('#minimizeCamera');
  if (miniBtn && await miniBtn.isVisible()) {
    await miniBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'screenshot_mini_player.png' });
    console.log('Salvo screenshot_mini_player.png');
  }

  // 4. Alternar para MAP (2D)
  console.log('Alternando para MAP 2D...');
  const mapBtn = await page.$('[data-view="city"]');
  if (mapBtn) {
    await mapBtn.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'screenshot_map_2d.png' });
    console.log('Salvo screenshot_map_2d.png');
  }

  // 5. Voltar para GLOBE 3D
  console.log('Voltando para GLOBE 3D...');
  const globeBtn = await page.$('[data-view="globe"]');
  if (globeBtn) {
    await globeBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshot_back_globe.png' });
    console.log('Salvo screenshot_back_globe.png');
  }

  await browser.close();
  console.log('Testes finalizados com sucesso!');
})();
