const consultaPlacaDB = require('./consultaPlacaDB');

const PLACA_DEBUG_PREFIX = 'PLACA_HTTP_DEBUG|';
const PLACA_RECAPTCHA_SITE_KEY = process.env.PLACA_RECAPTCHA_SITE_KEY || '6LfdGNwqAAAAADWxDE1qnjJ4ySjBuoZdqvBzCv1h';
const PLACA_RECAPTCHA_ACTION = process.env.PLACA_RECAPTCHA_ACTION || 'consulta_placa';
const PLACA_ENDPOINT = '/apiv2/index.php/get-morosidad-tag/json';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function esRecaptchaInvalido(resultado) {
  if (!resultado) {
    return false;
  }

  const msg = String(resultado.message || '').toLowerCase();
  return resultado.success === false && msg.includes('recaptcha') && msg.includes('inválido');
}

function getRecaptchaRetryConfig() {
  const maxRetries = parseInt(process.env.RECAPTCHA_MAX_RETRIES || '2', 10);
  const baseDelay = parseInt(process.env.RECAPTCHA_RETRY_BASE_DELAY_MS || '2500', 10);
  return {
    maxRetries: Number.isFinite(maxRetries) ? Math.max(0, maxRetries) : 2,
    baseDelay: Number.isFinite(baseDelay) ? Math.max(500, baseDelay) : 2500
  };
}

async function ejecutarConsultaPlacaEnPagina(page, plate, siteKey, action, endpoint, captchaToken = null) {
  return await page.evaluate(async (placa, prefix, recaptchaSiteKey, recaptchaAction, placaEndpoint, tokenManual) => {
    const token = tokenManual || await new Promise((resolve, reject) => {
      grecaptcha.ready(() => {
        grecaptcha.execute(recaptchaSiteKey, { action: recaptchaAction })
          .then(resolve)
          .catch(reject);
      });
    });

    let resp;
    try {
      resp = await fetch(placaEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: new URLSearchParams({
          plate: placa,
          captcha_token: token
        })
      });
    } catch (fetchError) {
      const debugPayload = {
        endpoint: placaEndpoint,
        origin: location.origin,
        href: location.href,
        recaptchaAction,
        fetchError: fetchError && fetchError.message ? fetchError.message : String(fetchError)
      };
      throw new Error(`${prefix}${JSON.stringify(debugPayload)}`);
    }

    const contentType = resp.headers.get('content-type') || '';
    const rawBody = await resp.text();

    let data;
    try {
      data = JSON.parse(rawBody);
    } catch (parseError) {
      const bodyPreview = rawBody.slice(0, 1000).replace(/\s+/g, ' ').trim();
      const debugPayload = {
        endpoint: resp.url,
        status: resp.status,
        contentType: contentType || 'desconocido',
        bodyPreview
      };
      throw new Error(`${prefix}${JSON.stringify(debugPayload)}`);
    }

    if (!resp.ok) {
      const detalle = data && (data.message || data.error) ? (data.message || data.error) : 'sin detalle';
      throw new Error(`Error HTTP ${resp.status} consultando placa: ${detalle}`);
    }

    return { plate: placa, ...data };
  }, plate, PLACA_DEBUG_PREFIX, siteKey, action, endpoint, captchaToken);
}

async function consultarConReintentoRecaptcha(page, plate, captchaToken = null) {
  const { maxRetries, baseDelay } = getRecaptchaRetryConfig();

  if (captchaToken) {
    return await ejecutarConsultaPlacaEnPagina(
      page,
      plate,
      PLACA_RECAPTCHA_SITE_KEY,
      PLACA_RECAPTCHA_ACTION,
      PLACA_ENDPOINT,
      captchaToken
    );
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resultado = await ejecutarConsultaPlacaEnPagina(
      page,
      plate,
      PLACA_RECAPTCHA_SITE_KEY,
      PLACA_RECAPTCHA_ACTION,
      PLACA_ENDPOINT,
      null
    );

    if (!esRecaptchaInvalido(resultado)) {
      return resultado;
    }

    if (attempt === maxRetries) {
      return resultado;
    }

    const delay = baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 1200);
    console.log(`⚠️ reCAPTCHA inválido para ${plate}. Reintentando ${attempt + 1}/${maxRetries} en ${delay}ms...`);

    try {
      await page.reload({ waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForFunction(
        () => window.grecaptcha && typeof grecaptcha.execute === 'function',
        { timeout: 60000 }
      );
      console.log(`✅ Página recargada para reintento de ${plate}`);
    } catch (reloadError) {
      console.warn(`⚠️ No se pudo recargar página para reintento de ${plate}:`, reloadError.message);
    }

    await sleep(delay);
  }
}

function logDetalleErrorPlaca(plate, error) {
  const msg = error && error.message ? error.message : String(error);

  if (!msg.includes(PLACA_DEBUG_PREFIX)) {
    return;
  }

  const payload = msg.split(PLACA_DEBUG_PREFIX)[1];
  if (!payload) {
    return;
  }

  try {
    const debug = JSON.parse(payload);
    console.error('🧪 Debug consulta placa (respuesta no JSON):', {
      plate,
      endpoint: debug.endpoint,
      status: debug.status,
      contentType: debug.contentType,
      bodyPreview: debug.bodyPreview,
      timestamp: new Date().toISOString()
    });
  } catch (parseError) {
    console.error('🧪 Debug consulta placa (raw):', payload);
  }
}

// Variable para controlar si la DB está disponible
let dbDisponible = false;

// Función para verificar disponibilidad de DB
async function verificarDB() {
  try {
    const { testConnection } = require('../config/database');
    dbDisponible = await testConnection();
    return dbDisponible;
  } catch (error) {
    dbDisponible = false;
    return false;
  }
}

// Función original que guarda en base de datos
async function consultarPorPlaca(page, plate, fechaLote = null, horaEjecucion = null) {
  console.log(`🚗 Consultando Placa: ${plate}`);
  
  try {
    // Realizar consulta en el sitio web con reintento para captcha inválido
    const resultado = await consultarConReintentoRecaptcha(page, plate);

    // Verificar si DB está disponible antes de intentar guardar
    if (!dbDisponible) {
      await verificarDB();
    }

    if (dbDisponible) {
      // Guardar resultado en base de datos (sin interrumpir el flujo principal)
      try {
        if (resultado.success) {
          console.log(`💾 Guardando consulta de placa ${plate} en base de datos...`);
          const resultadoGuardado = await Promise.race([
            consultaPlacaDB.procesarYGuardarConsulta(plate, resultado, fechaLote, horaEjecucion),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout DB')), 5000))
          ]);

          if (resultadoGuardado.exito) {
            console.log(`✅ Consulta guardada exitosamente para ${plate} (ID: ${resultadoGuardado.registro_id})`);
          } else {
            console.log(`⚠️ No se pudo guardar consulta para ${plate}: ${resultadoGuardado.mensaje}`);
          }
        } else {
          console.log(`⚠️ Consulta de placa ${plate} sin éxito (${resultado.message || 'sin detalle'}). No se persiste en DB para evitar saldo 0.`);
        }
      } catch (dbError) {
        // Error en DB no debe afectar la respuesta principal
        console.error(`❌ Error guardando en DB para placa ${plate}:`, dbError.message);
        if (dbError.message.includes('timeout') || dbError.message.includes('Connection terminated')) {
          dbDisponible = false;
          console.log(`⚠️ Base de datos no disponible, continuando sin persistencia`);
        }
      }
    } else {
      console.log(`⚠️ Base de datos no disponible para ${plate}, continuando sin persistencia`);
    }

    return resultado;
    
  } catch (error) {
    logDetalleErrorPlaca(plate, error);
    console.error(`❌ Error consultando placa ${plate}:`, error.message);

    // No persistir errores para evitar registros con saldo 0 por fallos de CAPTCHA o scraping
    throw error;
  }
}

// Función nueva que NO guarda en base de datos
async function consultarPorPlacaSoloConsulta(page, plate, captchaToken = null) {
  console.log(`🔍 Consultando Placa (solo consulta): ${plate}`);
  
  try {
    // Realizar consulta en el sitio web SIN guardar en DB
    const resultado = await consultarConReintentoRecaptcha(page, plate, captchaToken);

    console.log(`✅ Consulta completada para ${plate} (sin persistencia)`);
    return resultado;
    
  } catch (error) {
    logDetalleErrorPlaca(plate, error);
    console.error(`❌ Error consultando placa ${plate}:`, error.message);
    throw error;
  }
}

module.exports = { 
  consultarPorPlaca, 
  consultarPorPlacaSoloConsulta,
  verificarDB
};
