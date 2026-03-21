const puppeteer = require('puppeteer');
const { getRandomProxy, hasProxies } = require('../config/proxies');
const { getRandomHeaders, retryWithBackoff } = require('../utils/antiDetection');

// Lista de User Agents para rotar
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
];

// Función para obtener un User Agent aleatorio
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Función para delay aleatorio
function randomDelay(min = null, max = null) {
  const minDelay = min || parseInt(process.env.MIN_DELAY) || 1000;
  const maxDelay = max || parseInt(process.env.MAX_DELAY) || 3000;
  return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
}

async function launchBrowser(useProxy = null, proxyUrl = null) {
  const shouldUseProxy = useProxy !== null ? useProxy : process.env.ENABLE_PROXIES === 'true';
  
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--ignore-certificate-errors',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--disable-blink-features=AutomationControlled'
  ];

  // Usar proxy si está disponible y habilitado
  if (shouldUseProxy && hasProxies()) {
    const proxy = proxyUrl || getRandomProxy();
    if (proxy) {
      args.push(`--proxy-server=${proxy}`);
      console.log('🌐 Usando proxy:', proxy);
    }
  } else if (shouldUseProxy && !hasProxies()) {
    console.log('⚠️ ENABLE_PROXIES=true pero PROXY_LIST está vacía. Se usará IP del servidor.');
  }

  return await puppeteer.launch({
    headless: true,
    ignoreHTTPSErrors: true,
    args
  });
}

async function preparePage(browser, targetUrl = null) {
  const page = await browser.newPage();
  const urlObjetivo = targetUrl || process.env.TARGET_URL || 'https://ena.com.pa/consulta-tu-saldo';

  // Configurar User Agent aleatorio
  const userAgent = getRandomUserAgent();
  await page.setUserAgent(userAgent);
  console.log('🔄 Usando User Agent:', userAgent);

  // Configurar viewport aleatorio
  const viewports = [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1280, height: 1024 }
  ];
  const viewport = viewports[Math.floor(Math.random() * viewports.length)];
  await page.setViewport(viewport);

  // Configurar headers aleatorios
  const headers = getRandomHeaders();
  await page.setExtraHTTPHeaders(headers);

  // Ocultar que es un navegador automatizado
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    
    // Sobrescribir el objeto chrome para parecer más real
    window.chrome = {
      runtime: {},
    };
    
    // Sobrescribir los plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    
    // Sobrescribir los idiomas
    Object.defineProperty(navigator, 'languages', {
      get: () => ['es-ES', 'es', 'en'],
    });

    // Eliminar el indicador de automatización
    delete navigator.__proto__.webdriver;
  });

  page.on('framenavigated', frame => {
    console.log('➡️ Navegando a:', frame.url());
  });

  // Usar reintentos con backoff exponencial
  const maxRetries = parseInt(process.env.MAX_RETRIES) || 3;
  return await retryWithBackoff(async () => {
    // Delay aleatorio antes de navegar
    await new Promise(r => setTimeout(r, randomDelay(500, 2000)));

    await page.goto(urlObjetivo, {
      waitUntil: 'networkidle2',
      timeout: 90000 // Aumentamos el timeout
    });

    // Delay aleatorio después de cargar
    await new Promise(r => setTimeout(r, randomDelay(2000, 4000)));

    await page.waitForFunction(
      () => window.grecaptcha && typeof grecaptcha.execute === 'function',
      { timeout: 60000 } // Aumentamos el timeout
    );

    console.log('✅ grecaptcha listo');
    return page;
  }, maxRetries, 2000);
}

async function getPublicIPFromPage(page) {
  try {
    return await page.evaluate(async () => {
      const endpoints = [
        'https://api64.ipify.org?format=json',
        'https://api.ipify.org?format=json'
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, { method: 'GET' });
          if (!response.ok) {
            continue;
          }

          const data = await response.json();
          if (data && data.ip) {
            return data.ip;
          }
        } catch (error) {
          // Probar siguiente endpoint
        }
      }

      return null;
    });
  } catch (error) {
    return null;
  }
}

async function logCurrentPublicIP(page, label = '') {
  const ip = await getPublicIPFromPage(page);
  const prefix = label ? ` [${label}]` : '';

  if (ip) {
    console.log(`🌍 IP pública detectada${prefix}: ${ip}`);
  } else {
    console.log(`⚠️ No se pudo detectar IP pública${prefix}`);
  }

  return ip;
}

module.exports = { launchBrowser, preparePage, randomDelay, logCurrentPublicIP };
