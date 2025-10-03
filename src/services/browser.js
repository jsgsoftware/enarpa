const puppeteer = require('puppeteer');

async function launchBrowser() {
  return await puppeteer.launch({
    headless: true,
    ignoreHTTPSErrors: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--ignore-certificate-errors'
    ]
  });
}

async function preparePage(browser) {
  const page = await browser.newPage();

  page.on('framenavigated', frame => {
    console.log('➡️ Navegando a:', frame.url());
  });

  await page.goto('https://ena.com.pa/consulta-tu-saldo', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await new Promise(r => setTimeout(r, 2000));

  await page.waitForFunction(
    () => window.grecaptcha && typeof grecaptcha.execute === 'function',
    { timeout: 45000 }
  );

  console.log('✅ grecaptcha listo');
  return page;
}

module.exports = { launchBrowser, preparePage };
