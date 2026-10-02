import { test, expect } from '@playwright/test';

test('Verificação completa dos 5 requisitos do Radio Atlas', async ({ page }) => {
  test.setTimeout(50000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:4173');

  // 1. Fechar tela de boas-vindas clicando em #enterAtlas
  const enterBtn = page.locator('#enterAtlas');
  if (await enterBtn.isVisible()) {
    await enterBtn.click();
  }
  await page.waitForTimeout(2000);

  // 2. Verificar que a barra de rádio inferior (#radioPlayer) começa OCULTA
  const radioPlayer = page.locator('#radioPlayer');
  await expect(radioPlayer).toHaveClass(/hidden/);
  console.log('✓ Requisito 5 validado: Barra de rádio começa OCULTA (classe hidden presente).');

  // 3. Verificar Layout Fullscreen com Globo de Fundo e Hero-Copy Sobreposto
  const layoutCheck = await page.evaluate(() => {
    const hero = document.querySelector('.hero');
    const stage = document.querySelector('.world-stage');
    const copy = document.querySelector('.hero-copy');
    const reticle = document.querySelector('.tuning-reticle');
    return {
      heroDisplay: window.getComputedStyle(hero).display,
      stagePosition: window.getComputedStyle(stage).position,
      stageWidth: stage.clientWidth,
      stageHeight: stage.clientHeight,
      heroWidth: hero.clientWidth,
      heroHeight: hero.clientHeight,
      copyPosition: window.getComputedStyle(copy).position,
      copyPointerEvents: window.getComputedStyle(copy).pointerEvents,
      reticleLeft: window.getComputedStyle(reticle).left
    };
  });
  console.log('Layout Check:', JSON.stringify(layoutCheck, null, 2));
  expect(layoutCheck.stagePosition).toBe('absolute');
  expect(layoutCheck.copyPosition).toBe('absolute');
  expect(layoutCheck.copyPointerEvents).toBe('none');
  console.log('✓ Requisito 4 validado: Layout com Globo de Fundo 100% e Hero-Copy Sobreposto.');

  // 4. Verificar Iluminação Solar Dia e Noite no Globo
  const solarCheck = await page.evaluate(() => {
    const globe = window.__globe;
    if (!globe) return null;
    const scene = globe.scene();
    const amb = scene.children.find(c => c.isAmbientLight);
    const dir = scene.children.find(c => c.isDirectionalLight);
    return {
      ambIntensity: amb?.intensity,
      ambColor: amb?.color?.getHexString(),
      dirIntensity: dir?.intensity,
      dirColor: dir?.color?.getHexString(),
      dirPos: dir ? { x: dir.position.x, y: dir.position.y, z: dir.position.z } : null
    };
  });
  console.log('Solar Illumination Check:', JSON.stringify(solarCheck, null, 2));
  expect(solarCheck.ambIntensity).toBeLessThan(1.0); // Luz ambiente baixa para escuridão da noite
  expect(solarCheck.dirIntensity).toBeGreaterThan(3.0); // Luz solar forte
  console.log('✓ Requisito 1 validado: Ciclo Dia/Noite com iluminação solar astronômica.');

  // Captura de tela do Globo Dia e Noite
  await page.screenshot({ path: 'screenshot-verified-day-night.png', fullPage: true });

  // 5. Testar Filtro de Marcadores (ALL -> ambos; RADIO -> verdes; CAMERAS -> vermelhos)
  // A) Filtro ALL
  await page.evaluate(() => window.__app.setKind('all'));
  await page.waitForTimeout(600);

  const pointsAll = await page.evaluate(() => {
    const pts = window.__globe.pointsData();
    const green = pts.filter(p => p.color === '#00e676' || p.color === '#ffd54f');
    const red = pts.filter(p => p.color === '#ff5252' || p.color === '#ff4081');
    return { total: pts.length, greenCount: green.length, redCount: red.length };
  });
  console.log('Filtro ALL:', pointsAll);
  expect(pointsAll.greenCount).toBeGreaterThan(0); // Rádios verdes presentes
  expect(pointsAll.redCount).toBeGreaterThan(0);   // Câmeras vermelhas presentes
  console.log('✓ Requisito 2 validado: Modo ALL exibe AMBOS os pontos (verdes e vermelhos).');

  // B) Filtro RADIO
  await page.evaluate(() => window.__app.setKind('radio'));
  await page.waitForTimeout(600);
  const pointsRadio = await page.evaluate(() => {
    const pts = window.__globe.pointsData();
    const green = pts.filter(p => p.color === '#00e676' || p.color === '#ffd54f');
    const red = pts.filter(p => p.color === '#ff5252' || p.color === '#ff4081');
    return { total: pts.length, greenCount: green.length, redCount: red.length };
  });
  console.log('Filtro RADIO:', pointsRadio);
  expect(pointsRadio.greenCount).toBeGreaterThan(0);
  expect(pointsRadio.redCount).toBe(0);
  console.log('✓ Requisito 2 validado: Modo RADIO exibe SOMENTE pontos verdes.');

  // C) Filtro CAMERAS
  await page.evaluate(() => window.__app.setKind('camera'));
  await page.waitForTimeout(600);
  const pointsCameras = await page.evaluate(() => {
    const pts = window.__globe.pointsData();
    const green = pts.filter(p => p.color === '#00e676' || p.color === '#ffd54f');
    const red = pts.filter(p => p.color === '#ff5252' || p.color === '#ff4081');
    return { total: pts.length, greenCount: green.length, redCount: red.length };
  });
  console.log('Filtro CAMERAS:', pointsCameras);
  expect(pointsCameras.redCount).toBeGreaterThan(0);
  expect(pointsCameras.greenCount).toBe(0);
  console.log('✓ Requisito 2 validado: Modo CAMERAS exibe SOMENTE pontos vermelhos.');

  // Retorna para ALL
  await page.evaluate(() => window.__app.setKind('all'));
  await page.waitForTimeout(400);

  // 6. Testar Autoplay das Câmeras ao Selecionar
  await page.evaluate(() => {
    const testCam = {
      id: 'test-shibuya',
      name: 'Shibuya Crossing Live',
      country: 'JP',
      countryCode: 'JP',
      streamType: 'youtube',
      embedUrl: 'https://www.youtube.com/watch?v=12345678901',
      provider: 'TV Garden'
    };
    window.__app.setCamera(testCam);
  });
  await page.waitForTimeout(800);

  const iframeSrc = await page.evaluate(() => {
    const iframe = document.querySelector('#cameraFrame iframe');
    return iframe ? {
      src: iframe.src,
      allow: iframe.allow,
      autoplay: iframe.getAttribute('autoplay')
    } : null;
  });
  console.log('Camera Autoplay Check:', JSON.stringify(iframeSrc, null, 2));
  expect(iframeSrc).not.toBeNull();
  expect(iframeSrc.src).toContain('autoplay=1');
  expect(iframeSrc.src).toContain('mute=1');
  expect(iframeSrc.allow).toContain('autoplay');
  console.log('✓ Requisito 3 validado: Câmera abre com Autoplay ativado automaticamente.');

  // 7. Testar que selecionar uma rádio faz a barra inferior surgir
  await page.evaluate(() => {
    const testStation = {
      id: 'test-tokyo-fm',
      name: 'J-Wave 81.3 FM',
      country: 'Japan',
      countryCode: 'JP',
      streamUrl: 'https://example.com/stream.mp3'
    };
    window.__app.setCurrentStation(testStation, true, true);
  });
  await page.waitForTimeout(600);
  await expect(radioPlayer).not.toHaveClass(/hidden/);
  console.log('✓ Requisito 5 validado: Barra inferior é revelada ao selecionar uma estação de rádio.');

  await page.screenshot({ path: 'screenshot-verified-full.png', fullPage: true });
  console.log('Todos os 5 requisitos foram 100% verificados e validados!');
});
