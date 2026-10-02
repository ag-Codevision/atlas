import { chromium } from '@playwright/test';

(async () => {
  console.log('--- Iniciando Teste de Validação Radio Garden + TV Garden ---');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Escuta erros do console no navegador
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[Console Error]:', msg.text());
  });

  await page.goto('http://127.0.0.1:4173');
  await page.waitForTimeout(1000);

  // Fecha tela de boas-vindas se visível
  const enterBtn = await page.$('#enterAtlas');
  if (enterBtn && await enterBtn.isVisible()) {
    await enterBtn.click();
    console.log('Tela de boas-vindas dispensada.');
  }
  await page.waitForTimeout(2500);

  // 1. Validação dos elementos do Radio Garden
  const reticle = await page.$('#tuningReticle');
  const reticleVisible = reticle && await reticle.isVisible();
  console.log('Retícula central de sintonia presente:', reticleVisible);

  const gardenCount = await page.evaluate(() => {
    return window.location ? (window.document.querySelectorAll('#metricStationCount')[0]?.textContent) : null;
  });
  console.log('Contador de estações no painel:', gardenCount);

  // Screenshot inicial do Globo com a retícula e pontos verdes
  await page.screenshot({ path: 'screenshot_radio_garden_globe.png' });
  console.log('Salvo screenshot_radio_garden_globe.png');

  // 2. Teste de Arrastar o Globo (Simulação de sintonia estilo Radio Garden)
  console.log('Arrastando o globo terrestre...');
  await page.mouse.move(800, 450);
  await page.mouse.down();
  await page.mouse.move(700, 420, { steps: 15 });
  await page.waitForTimeout(600);
  await page.mouse.up();
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'screenshot_radio_garden_reticle_tuned.png' });
  console.log('Salvo screenshot_radio_garden_reticle_tuned.png');

  // 3. Teste do Botão "Somewhere new" (Teletransporte Global)
  console.log('Testando "Somewhere new" (viagem aleatória)...');
  const surpriseBtn = await page.$('#surpriseButton');
  if (surpriseBtn) {
    await surpriseBtn.click();
    await page.waitForTimeout(3000);
    const newCity = await page.$eval('#cityTitle', el => el.textContent);
    console.log('Cidade sorteada e sintonizada:', newCity);
    await page.screenshot({ path: 'screenshot_somewhere_new.png' });
    console.log('Salvo screenshot_somewhere_new.png');
  }

  // 4. Teste de troca de estação com Next Station (▸|)
  console.log('Testando troca de frequência (Next Station)...');
  const nextBtn = await page.$('#nextStation');
  const currentStationBefore = await page.$eval('#playerStationName', el => el.textContent);
  console.log('Estação antes:', currentStationBefore);
  if (nextBtn) {
    await nextBtn.click();
    await page.waitForTimeout(2000);
    const currentStationAfter = await page.$eval('#playerStationName', el => el.textContent);
    console.log('Estação depois:', currentStationAfter);
    await page.screenshot({ path: 'screenshot_station_switch.png' });
    console.log('Salvo screenshot_station_switch.png');
  }

  // 5. Teste de LISTEN + WATCH integrado
  console.log('Testando LISTEN + WATCH...');
  const lwBtn = await page.$('#listenWatchMain');
  if (lwBtn) {
    await lwBtn.click();
    await page.waitForTimeout(3000);
    const cameraPanelVisible = await page.$eval('#cameraPanel', el => !el.classList.contains('hidden'));
    console.log('Painel de Câmera visível:', cameraPanelVisible);
    await page.screenshot({ path: 'screenshot_listen_watch_garden.png' });
    console.log('Salvo screenshot_listen_watch_garden.png');
  }

  await browser.close();
  console.log('--- Testes de Validação Concluídos com Sucesso! ---');
})();
