const consultaPlacaDB = require('./consultaPlacaDB');

const PLACA_DEBUG_PREFIX = 'PLACA_HTTP_DEBUG|';

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
    // Realizar consulta en el sitio web
    const resultado = await page.evaluate(async (placa) => {
      const token = await new Promise((resolve, reject) => {
        grecaptcha.ready(() => {
          grecaptcha.execute('6LcgI9wqAAAAAEPWc0dOvIwJakaL7crE9LH9951j', { action: 'consulta' })
            .then(resolve)
            .catch(reject);
        });
      });

      const resp = await fetch('/apiv2/index.php/get-morosidad-tag/json', {
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
        throw new Error(`${PLACA_DEBUG_PREFIX}${JSON.stringify(debugPayload)}`);
      }

      if (!resp.ok) {
        const detalle = data && (data.message || data.error) ? (data.message || data.error) : 'sin detalle';
        throw new Error(`Error HTTP ${resp.status} consultando placa: ${detalle}`);
      }

      return { plate: placa, ...data };
    }, plate);

    // Verificar si DB está disponible antes de intentar guardar
    if (!dbDisponible) {
      await verificarDB();
    }

    if (dbDisponible) {
      // Guardar resultado en base de datos (sin interrumpir el flujo principal)
      try {
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
    
    // Intentar guardar el error también solo si DB está disponible
    if (dbDisponible) {
      try {
        await Promise.race([
          consultaPlacaDB.procesarYGuardarConsulta(plate, {
            success: false,
            message: error.message,
            chkDefaulter: null,
            typeAccount: null,
            balanceAmount: null,
            totalAmount: null
          }, fechaLote, horaEjecucion),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout DB')), 3000))
        ]);
      } catch (dbError) {
        console.error(`❌ Error guardando error en DB para placa ${plate}:`, dbError.message);
        dbDisponible = false;
      }
    }
    
    throw error;
  }
}

// Función nueva que NO guarda en base de datos
async function consultarPorPlacaSoloConsulta(page, plate) {
  console.log(`🔍 Consultando Placa (solo consulta): ${plate}`);
  
  try {
    // Realizar consulta en el sitio web SIN guardar en DB
    const resultado = await page.evaluate(async (placa) => {
      const token = await new Promise((resolve, reject) => {
        grecaptcha.ready(() => {
          grecaptcha.execute('6LcgI9wqAAAAAEPWc0dOvIwJakaL7crE9LH9951j', { action: 'consulta' })
            .then(resolve)
            .catch(reject);
        });
      });

      const resp = await fetch('/apiv2/index.php/get-morosidad-tag/json', {
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
        throw new Error(`${PLACA_DEBUG_PREFIX}${JSON.stringify(debugPayload)}`);
      }

      if (!resp.ok) {
        const detalle = data && (data.message || data.error) ? (data.message || data.error) : 'sin detalle';
        throw new Error(`Error HTTP ${resp.status} consultando placa: ${detalle}`);
      }

      return { plate: placa, ...data };
    }, plate);

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
