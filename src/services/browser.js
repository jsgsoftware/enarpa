const puppeteer = require('puppeteer');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { getRandomProxy, hasProxies } = require('../config/proxies');
const { getRandomHeaders, retryWithBackoff } = require('../utils/antiDetection');

const BROWSER_TMP_ROOT = process.env.BROWSER_TMP_ROOT || path.join(os.tmpdir(), 'enarpa-browser');
const activeBrowserResources = new Set();
let browserSessionCounter = 0;

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

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function createBrowserRuntimeDirs() {
  await ensureDir(BROWSER_TMP_ROOT);

  const sessionRoot = await fs.mkdtemp(path.join(BROWSER_TMP_ROOT, 'session-'));
  const userDataDir = path.join(sessionRoot, 'profile');
  const cacheDir = path.join(sessionRoot, 'cache');
  const downloadsDir = path.join(sessionRoot, 'downloads');
  const crashDir = path.join(sessionRoot, 'crashpad');

  await Promise.all([
    ensureDir(userDataDir),
    ensureDir(cacheDir),
    ensureDir(downloadsDir),
    ensureDir(crashDir)
  ]);

  return {
    sessionRoot,
    userDataDir,
    cacheDir,
    downloadsDir,
    crashDir
  };
}

async function removeBrowserTempDir(resource) {
  if (!resource || !resource.sessionRoot) {
    return;
  }

  try {
    await fs.rm(resource.sessionRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    console.log(`🧹 Runtime temporal de browser eliminado: ${resource.sessionRoot}`);
  } catch (error) {
    console.warn(`⚠️ No se pudo eliminar runtime temporal ${resource.sessionRoot}:`, error.message);
  }
}

function attachBrowserCleanup(browser, resource) {
  let cleaned = false;

  const cleanup = async () => {
    if (cleaned) {
      return;
    }

    cleaned = true;
    activeBrowserResources.delete(resource);
    await removeBrowserTempDir(resource);
  };

  browser.once('disconnected', () => {
    cleanup().catch(error => {
      console.warn('⚠️ Error limpiando runtime temporal tras disconnect:', error.message);
    });
  });

  browser.__enarpaCleanup = cleanup;
  browser.__enarpaResource = resource;
  activeBrowserResources.add(resource);
}

async function launchBrowser(useProxy = null, proxyUrl = null) {
  const shouldUseProxy = useProxy !== null ? useProxy : process.env.ENABLE_PROXIES === 'true';
  const runtimeDirs = await createBrowserRuntimeDirs();
  
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
    '--disable-blink-features=AutomationControlled',
    '--disable-crash-reporter',
    '--disable-breakpad',
    '--disable-logging',
    '--metrics-recording-only',
    `--disk-cache-dir=${runtimeDirs.cacheDir}`,
    `--homedir=${runtimeDirs.userDataDir}`,
    `--crash-dumps-dir=${runtimeDirs.crashDir}`
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

  try {
    const browser = await puppeteer.launch({
      headless: true,
      ignoreHTTPSErrors: true,
      userDataDir: runtimeDirs.userDataDir,
      args,
      env: {
        ...process.env,
        TMPDIR: runtimeDirs.sessionRoot,
        TMP: runtimeDirs.sessionRoot,
        TEMP: runtimeDirs.sessionRoot,
        XDG_CACHE_HOME: runtimeDirs.cacheDir,
        XDG_CONFIG_HOME: runtimeDirs.userDataDir
      }
    });

    attachBrowserCleanup(browser, runtimeDirs);
    console.log(`🗂️ Runtime temporal de browser: ${runtimeDirs.sessionRoot}`);
    return browser;
  } catch (error) {
    await removeBrowserTempDir(runtimeDirs);
    throw error;
  }
}

async function preparePage(browser, targetUrl = null) {
  const page = await browser.newPage();
  const urlObjetivo = targetUrl || process.env.TARGET_URL || 'https://ena.com.pa/consulta-tu-saldo';
  const browserResource = browser.__enarpaResource;

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

  if (browserResource && browserResource.downloadsDir) {
    try {
      const client = await page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'deny',
        downloadPath: browserResource.downloadsDir
      });
    } catch (error) {
      console.warn('⚠️ No se pudo configurar política de descargas del browser:', error.message);
    }
  }

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

function nextBrowserSessionId() {
  browserSessionCounter += 1;
  return `browser_${Date.now()}_${browserSessionCounter}`;
}

function classifyBrowserError(error) {
  const message = String(error && error.message ? error.message : error || '').toLowerCase();

  if (message.includes('recaptcha') && message.includes('inv')) {
    return 'recaptcha_invalid';
  }

  if (message.includes('navigation') || message.includes('timeout') || message.includes('networkidle')) {
    return 'navigation';
  }

  return 'generic';
}

function createSessionLog(label, event, data = {}) {
  console.log(`🧭 BrowserSession ${event}:`, {
    label,
    ...data
  });
}

async function closeBrowserResources(page = null, browser = null, label = '') {
  const prefix = label ? ` [${label}]` : '';

  if (page) {
    try {
      if (!page.isClosed()) {
        await page.close({ runBeforeUnload: false });
      }
    } catch (error) {
      console.warn(`⚠️ Error cerrando page${prefix}:`, error.message);
    }
  }

  if (browser) {
    try {
      if (browser.connected) {
        await browser.close();
      }
    } catch (error) {
      console.warn(`⚠️ Error cerrando browser${prefix}:`, error.message);
      try {
        await browser.disconnect();
      } catch (disconnectError) {
        console.warn(`⚠️ Error desconectando browser${prefix}:`, disconnectError.message);
      }
    }

    if (typeof browser.__enarpaCleanup === 'function') {
      try {
        await browser.__enarpaCleanup();
      } catch (cleanupError) {
        console.warn(`⚠️ Error limpiando temporales de browser${prefix}:`, cleanupError.message);
      }
    }
  }
}

async function createBrowserSession(options = {}) {
  const {
    targetUrl = null,
    useProxy = null,
    proxyUrl = null,
    label = 'browser-session',
    metadata = {}
  } = options;

  const sessionId = nextBrowserSessionId();
  const browser = await launchBrowser(useProxy, proxyUrl);
  const page = await preparePage(browser, targetUrl);
  const now = Date.now();

  const session = {
    id: sessionId,
    label,
    browser,
    page,
    userDataDir: browser.__enarpaResource ? browser.__enarpaResource.userDataDir : null,
    sessionRoot: browser.__enarpaResource ? browser.__enarpaResource.sessionRoot : null,
    createdAt: new Date(now).toISOString(),
    createdAtMs: now,
    lastUsedAtMs: now,
    metadata: { ...metadata },
    metrics: {
      lotesProcesados: 0,
      placasProcesadas: 0,
      erroresConsecutivos: 0,
      recaptchaInvalidoConsecutivo: 0,
      reiniciosSolicitados: 0,
      ultimoErrorTipo: null,
      ultimoErrorMensaje: null,
      ultimaPlaca: null
    }
  };

  createSessionLog(label, 'started', {
    sessionId,
    sessionRoot: session.sessionRoot,
    userDataDir: session.userDataDir,
    metadata: session.metadata
  });

  return session;
}

function markBrowserSessionSuccess(session, details = {}) {
  if (!session) {
    return;
  }

  session.lastUsedAtMs = Date.now();
  session.metrics.placasProcesadas += details.incrementPlates || 0;
  session.metrics.lotesProcesados += details.incrementBatches || 0;
  session.metrics.erroresConsecutivos = 0;
  session.metrics.recaptchaInvalidoConsecutivo = 0;
  session.metrics.ultimoErrorTipo = null;
  session.metrics.ultimoErrorMensaje = null;

  if (details.placa) {
    session.metrics.ultimaPlaca = details.placa;
  }
}

function markBrowserSessionError(session, error, details = {}) {
  if (!session) {
    return;
  }

  const errorType = classifyBrowserError(error);
  session.lastUsedAtMs = Date.now();
  session.metrics.erroresConsecutivos += 1;
  session.metrics.ultimoErrorTipo = errorType;
  session.metrics.ultimoErrorMensaje = error && error.message ? error.message : String(error);

  if (details.placa) {
    session.metrics.ultimaPlaca = details.placa;
  }

  if (errorType === 'recaptcha_invalid') {
    session.metrics.recaptchaInvalidoConsecutivo += 1;
  } else {
    session.metrics.recaptchaInvalidoConsecutivo = 0;
  }

  createSessionLog(session.label, 'error', {
    sessionId: session.id,
    errorType,
    placa: details.placa || null,
    erroresConsecutivos: session.metrics.erroresConsecutivos,
    recaptchaInvalidoConsecutivo: session.metrics.recaptchaInvalidoConsecutivo,
    message: session.metrics.ultimoErrorMensaje
  });
}

function shouldRecycleBrowserSession(session, policy = {}) {
  if (!session) {
    return { recycle: true, reasons: ['missing_session'] };
  }

  const {
    force = false,
    maxBatches = parseInt(process.env.BROWSER_MAX_BATCHES_PER_SESSION || '3', 10),
    maxPlates = parseInt(process.env.BROWSER_MAX_PLATES_PER_SESSION || '15', 10),
    maxAgeMs = parseInt(process.env.BROWSER_MAX_AGE_MS || '900000', 10),
    maxConsecutiveErrors = parseInt(process.env.BROWSER_MAX_CONSECUTIVE_ERRORS || '2', 10),
    maxConsecutiveRecaptchaErrors = parseInt(process.env.BROWSER_MAX_CONSECUTIVE_RECAPTCHA_ERRORS || '2', 10)
  } = policy;

  const reasons = [];
  const ageMs = Date.now() - session.createdAtMs;

  if (force) {
    reasons.push('forced');
  }
  if (Number.isFinite(maxBatches) && maxBatches > 0 && session.metrics.lotesProcesados >= maxBatches) {
    reasons.push(`max_batches:${session.metrics.lotesProcesados}/${maxBatches}`);
  }
  if (Number.isFinite(maxPlates) && maxPlates > 0 && session.metrics.placasProcesadas >= maxPlates) {
    reasons.push(`max_plates:${session.metrics.placasProcesadas}/${maxPlates}`);
  }
  if (Number.isFinite(maxAgeMs) && maxAgeMs > 0 && ageMs >= maxAgeMs) {
    reasons.push(`max_age_ms:${ageMs}/${maxAgeMs}`);
  }
  if (Number.isFinite(maxConsecutiveErrors) && maxConsecutiveErrors > 0 && session.metrics.erroresConsecutivos >= maxConsecutiveErrors) {
    reasons.push(`consecutive_errors:${session.metrics.erroresConsecutivos}/${maxConsecutiveErrors}`);
  }
  if (Number.isFinite(maxConsecutiveRecaptchaErrors) && maxConsecutiveRecaptchaErrors > 0 && session.metrics.recaptchaInvalidoConsecutivo >= maxConsecutiveRecaptchaErrors) {
    reasons.push(`consecutive_recaptcha:${session.metrics.recaptchaInvalidoConsecutivo}/${maxConsecutiveRecaptchaErrors}`);
  }

  return {
    recycle: reasons.length > 0,
    reasons,
    ageMs
  };
}

async function safeCloseBrowserSession(session = null, reason = 'normal_close') {
  if (!session) {
    return;
  }

  createSessionLog(session.label, 'closed', {
    sessionId: session.id,
    reason,
    metrics: session.metrics,
    sessionRoot: session.sessionRoot
  });

  await closeBrowserResources(session.page, session.browser, `${session.label}|${reason}`);

  session.browser = null;
  session.page = null;
}

async function cleanupAllBrowserResources() {
  const resources = Array.from(activeBrowserResources);
  await Promise.all(resources.map(resource => removeBrowserTempDir(resource)));
  activeBrowserResources.clear();
}

module.exports = {
  launchBrowser,
  preparePage,
  createBrowserSession,
  safeCloseBrowserSession,
  markBrowserSessionSuccess,
  markBrowserSessionError,
  shouldRecycleBrowserSession,
  randomDelay,
  logCurrentPublicIP,
  closeBrowserResources,
  cleanupAllBrowserResources
};
