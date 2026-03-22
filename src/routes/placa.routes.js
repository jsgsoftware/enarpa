const express = require('express');
const authenticate = require('../middleware/auth');
const { launchBrowser, preparePage, randomDelay, logCurrentPublicIP } = require('../services/browser');
const { consultarPorPlaca, consultarPorPlacaSoloConsulta } = require('../services/placa');
const consultaPlacaDB = require('../services/consultaPlacaDB');
const { obtenerFechaPanama, obtenerHoraPanamaFormato, obtenerFechaPanamaISO } = require('../utils/timezone');

const router = express.Router();
const PLACA_TARGET_URL = process.env.PLACA_TARGET_URL || 'https://ena.com.pa/consulta-de-placa/';

function normalizarMonto(valor) {
  if (valor === null || valor === undefined || valor === '') {
    return 0;
  }

  const valorTexto = String(valor).trim();
  const numero = Number(valorTexto.replace(',', '.'));
  if (!Number.isFinite(numero)) {
    return 0;
  }

  if (valorTexto.includes('.') || valorTexto.includes(',')) {
    return numero;
  }

  return numero / 100;
}

function extraerMontoDesdeTexto(texto) {
  if (!texto || typeof texto !== 'string') {
    return null;
  }

  const match = texto.match(/B\/\.?\s*([0-9]+(?:[.,][0-9]{1,2})?)/i);
  if (!match || !match[1]) {
    return null;
  }

  const numero = Number(match[1].replace(',', '.'));
  return Number.isFinite(numero) ? numero : null;
}

function obtenerSaldoResultado(resultado) {
  if (resultado && resultado.balanceAmount !== null && resultado.balanceAmount !== undefined && resultado.balanceAmount !== '') {
    return normalizarMonto(resultado.balanceAmount);
  }

  const montoDesdeMensaje = extraerMontoDesdeTexto(resultado && resultado.message);
  return montoDesdeMensaje !== null ? montoDesdeMensaje : 0;
}

function obtenerAdeudadoResultado(resultado) {
  if (resultado && resultado.totalAmount !== null && resultado.totalAmount !== undefined && resultado.totalAmount !== '') {
    return normalizarMonto(resultado.totalAmount);
  }

  return 0;
}

function shouldRotateBrowserPerPlate() {
  return process.env.ROTATE_BROWSER_PER_PLATE === 'true';
}

function shouldLogPublicIPEachQuery() {
  return process.env.LOG_PUBLIC_IP_EACH_QUERY === 'true';
}

// Función para procesar placas en lotes
async function procesarLotesDePlacas(placas, batchSize = 10) {
  const lotes = [];
  for (let i = 0; i < placas.length; i += batchSize) {
    lotes.push(placas.slice(i, i + batchSize));
  }
  return lotes;
}

// Ruta optimizada para consultas masivas
router.post('/consulta-placa', authenticate, async (req, res) => {
  const listaPlacas = req.body.placas;
  if (!Array.isArray(listaPlacas) || listaPlacas.length === 0) {
    return res.status(400).json({ error: 'Debes enviar un array con las placas a consultar' });
  }

  // Establecer timeout de respuesta más largo
  req.setTimeout(600000); // 10 minutos
  res.setTimeout(600000); // 10 minutos

  // Enviar respuesta inmediata para evitar timeout y procesar en background
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Responder inmediatamente con ID de seguimiento
  res.json({
    message: 'Procesando consulta masiva de placas',
    requestId: requestId,
    totalPlacas: listaPlacas.length,
    estimatedTime: `${Math.ceil(listaPlacas.length * 3 / 60)} minutos`,
    status: 'processing'
  });

  // Procesar en background
  procesarConsultaMasiva(listaPlacas, requestId).catch(error => {
    console.error(`❌ Error en procesamiento background para ${requestId}:`, error.message);
  });
});

// Función para procesar consulta masiva en background
async function procesarConsultaMasiva(listaPlacas, requestId) {
  let browser = null;
  let page = null;
  const rotatePerPlate = shouldRotateBrowserPerPlate();
  const logIP = shouldLogPublicIPEachQuery();
  const resultados = { 
    requestId,
    consultados: [], 
    errores: [],
    procesados: 0,
    total: listaPlacas.length,
    iniciado: obtenerFechaPanamaISO(),
    finalizado: null,
    status: 'processing'
  };

  // Guardar estado inicial en cache
  resultadosCache.set(requestId, { ...resultados });

  try {
    console.log(`🚀 Iniciando procesamiento masivo para ${requestId} - ${listaPlacas.length} placas`);
    
    // Dividir en lotes de 5 placas para evitar sobrecarga
    const lotes = await procesarLotesDePlacas(listaPlacas, 5);
    
    for (let i = 0; i < lotes.length; i++) {
      const lote = lotes[i];
      console.log(`📦 Procesando lote ${i + 1}/${lotes.length} (${lote.length} placas)`);
      
      // 🕐 Generar fecha única para este lote al INICIO del lote (hora de Panamá)
      const fechaLote = obtenerFechaPanama();
      // 🕰️ Generar hora de ejecución única para TODAS las consultas de este lote (solo HH:MM en zona Panamá)
      const horaEjecucionLote = obtenerHoraPanamaFormato();
      console.log(`📅 Fecha del lote ${i + 1}: ${fechaLote.toISOString()}`);
      console.log(`🕰️ Hora de ejecución del lote ${i + 1}: ${horaEjecucionLote} (Panamá)`);
      
      try {
        // Reiniciar browser cada 3 lotes para evitar problemas de memoria
        if (!rotatePerPlate && (!browser || i % 3 === 0)) {
          if (browser) {
            console.log('🔄 Reiniciando navegador para mantener rendimiento...');
            await browser.close();
          }
          browser = await launchBrowser();
          page = await preparePage(browser, PLACA_TARGET_URL);
        }
        
        // Procesar lote actual
        for (const placa of lote) {
          try {
            console.log(`🔍 [${requestId}] Consultando placa: ${placa} (${resultados.procesados + 1}/${listaPlacas.length})`);

            if (rotatePerPlate) {
              if (browser) {
                try {
                  await browser.close();
                } catch (closeError) {
                  console.warn(`⚠️ [${requestId}] Error cerrando navegador previo:`, closeError.message);
                }
              }

              console.log(`🔄 [${requestId}] Rotando navegador/proxy para placa ${placa}`);
              browser = await launchBrowser();
              page = await preparePage(browser, PLACA_TARGET_URL);
            }

            if (logIP && page) {
              await logCurrentPublicIP(page, `${requestId}|placa:${placa}`);
            }
            
            // Pasar la fecha del lote y la hora de ejecución única para todas las consultas del lote
            const result = await consultarPorPlaca(page, placa, fechaLote, horaEjecucionLote);
            
            if (result.success) {
              resultados.consultados.push({
                plate: placa,
                chkDefaulter: result.chkDefaulter,
                typeAccount: result.typeAccount,
                saldo: obtenerSaldoResultado(result),
                adeudado: obtenerAdeudadoResultado(result)
              });
            } else {
              resultados.errores.push({ plate: placa, error: result.message });
            }
            
            resultados.procesados++;
            
            // Actualizar cache con progreso
            resultadosCache.set(requestId, { ...resultados });
            
            // Delay más corto entre consultas del mismo lote
            const delay = randomDelay(1000, 2000);
            await new Promise(r => setTimeout(r, delay));
            
          } catch (err) {
            console.error(`❌ [${requestId}] Error en ${placa}:`, err.message);
            resultados.errores.push({ plate: placa, error: 'Error inesperado en la consulta' });
            resultados.procesados++;
            
            // Actualizar cache con error
            resultadosCache.set(requestId, { ...resultados });
          }
        }
        
        // Delay más largo entre lotes
        if (i < lotes.length - 1) {
          const delayLote = randomDelay(3000, 7000);
          console.log(`⏸️ Pausa entre lotes: ${delayLote}ms`);
          await new Promise(r => setTimeout(r, delayLote));
        }
        
      } catch (loteError) {
        console.error(`❌ [${requestId}] Error en lote ${i + 1}:`, loteError.message);
        // Marcar placas del lote como error
        for (const placa of lote) {
          if (!resultados.consultados.find(r => r.plate === placa) && 
              !resultados.errores.find(r => r.plate === placa)) {
            resultados.errores.push({ plate: placa, error: 'Error en lote de procesamiento' });
            resultados.procesados++;
          }
        }
        // Actualizar cache
        resultadosCache.set(requestId, { ...resultados });
      }
    }
    
    resultados.status = 'completed';
    resultados.finalizado = obtenerFechaPanamaISO();
    
    console.log(`✅ [${requestId}] Procesamiento completado: ${resultados.consultados.length} exitosos, ${resultados.errores.length} errores`);
    
    // Actualizar cache final
    resultadosCache.set(requestId, { ...resultados });
    
    // Programar limpieza del cache después de 1 hora
    setTimeout(() => {
      resultadosCache.delete(requestId);
      console.log(`🗑️ Cache limpiado para ${requestId}`);
    }, 3600000);
    
  } catch (error) {
    console.error(`❌ [${requestId}] Error general:`, error.message);
    resultados.status = 'error';
    resultados.error = error.message;
    resultados.finalizado = obtenerFechaPanamaISO();
    
    // Actualizar cache con error
    resultadosCache.set(requestId, { ...resultados });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error(`❌ [${requestId}] Error al cerrar navegador:`, closeError.message);
      }
    }
  }
}

// Ruta para procesar pocas placas de forma síncrona (menos de 5)
router.post('/consulta-placa-sync', authenticate, async (req, res) => {
  const listaPlacas = req.body.placas;
  if (!Array.isArray(listaPlacas) || listaPlacas.length === 0) {
    return res.status(400).json({ error: 'Debes enviar un array con las placas a consultar' });
  }

  if (listaPlacas.length > 5) {
    return res.status(400).json({ 
      error: 'Para más de 5 placas usa el endpoint /consulta-placa para procesamiento asíncrono' 
    });
  }

  let browser = null;
  let page = null;
  const rotatePerPlate = shouldRotateBrowserPerPlate();
  const logIP = shouldLogPublicIPEachQuery();

  try {
    if (!rotatePerPlate) {
      browser = await launchBrowser();
      page = await preparePage(browser, PLACA_TARGET_URL);
    }
    
    // 🕐 Generar fecha única para este lote síncrono (hora de Panamá)
    const fechaLote = obtenerFechaPanama();
    // 🕰️ Generar hora de ejecución única para TODAS las consultas de este lote (solo HH:MM en zona Panamá)
    const horaEjecucionLote = obtenerHoraPanamaFormato();
    console.log(`📅 Fecha del lote síncrono: ${fechaLote.toISOString()}`);
    console.log(`🕰️ Hora de ejecución del lote síncrono: ${horaEjecucionLote} (Panamá)`);
    
    const resultados = { consultados: [], errores: [] };
    
    for (const placa of listaPlacas) {
      try {
        console.log(`🔍 Consultando placa: ${placa}`);

        if (rotatePerPlate) {
          if (browser) {
            try {
              await browser.close();
            } catch (closeError) {
              console.warn('⚠️ Error cerrando navegador previo en sync:', closeError.message);
            }
          }

          console.log(`🔄 Rotando navegador/proxy para placa ${placa} (sync)`);
          browser = await launchBrowser();
          page = await preparePage(browser, PLACA_TARGET_URL);
        }

        if (logIP && page) {
          await logCurrentPublicIP(page, `sync|placa:${placa}`);
        }
        
        // Pasar la fecha del lote y la hora de ejecución única para todas las consultas
        const result = await consultarPorPlaca(page, placa, fechaLote, horaEjecucionLote);
        
        if (result.success) {
          resultados.consultados.push({
            plate: placa,
            chkDefaulter: result.chkDefaulter,
            typeAccount: result.typeAccount,
            saldo: obtenerSaldoResultado(result),
            adeudado: obtenerAdeudadoResultado(result)
          });
        } else {
          resultados.errores.push({ plate: placa, error: result.message });
        }
        
        // Delay entre consultas
        const delay = randomDelay(1500, 3000);
        console.log(`⏱️ Esperando ${delay}ms antes de la siguiente consulta...`);
        await new Promise(r => setTimeout(r, delay));
        
      } catch (err) {
        console.error(`❌ Error en ${placa}:`, err.message);
        resultados.errores.push({ plate: placa, error: 'Error inesperado en la consulta' });
      }
    }
    
    res.json(resultados);
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('❌ Error al cerrar navegador:', closeError.message);
      }
    }
  }
});

// Almacén temporal para resultados (en producción usa Redis o base de datos)
const resultadosCache = new Map();

// Ruta para consultar estado de procesamiento
router.get('/consulta-status/:requestId', authenticate, (req, res) => {
  const { requestId } = req.params;
  
  const resultado = resultadosCache.get(requestId);
  
  if (!resultado) {
    return res.status(404).json({ error: 'Request ID no encontrado' });
  }
  
  res.json(resultado);
});

// Ruta para consulta única SIN guardar en base de datos
router.post('/consulta-placa-solo', authenticate, async (req, res) => {
  const { placa, captcha_token } = req.body;
  
  if (!placa || typeof placa !== 'string') {
    return res.status(400).json({ 
      error: 'Debes enviar una placa válida en el campo "placa"' 
    });
  }

  let browser = null;
  let page = null;

  try {
    console.log(`🔍 Iniciando consulta sin persistencia para placa: ${placa}`);
    
    // Lanzar browser con configuración anti-detección
    browser = await launchBrowser();
    page = await preparePage(browser, PLACA_TARGET_URL);

    if (shouldLogPublicIPEachQuery()) {
      await logCurrentPublicIP(page, `solo|placa:${placa}`);
    }
    
    // Realizar consulta SIN guardar en DB
    const resultado = await consultarPorPlacaSoloConsulta(page, placa, captcha_token || null);
    
    if (resultado.success) {
      const respuesta = {
        placa: placa,
        consultado_en: new Date().toISOString(),
        resultado: {
          chkDefaulter: resultado.chkDefaulter,
          typeAccount: resultado.typeAccount,
          saldo: obtenerSaldoResultado(resultado),
          adeudado: obtenerAdeudadoResultado(resultado)
        },
        raw_data: resultado, // Datos completos por si necesitas algo específico
        persistencia: false, // Indicar que NO se guardó en DB
        mensaje: 'Consulta realizada exitosamente (sin guardar en base de datos)'
      };
      
      console.log(`✅ Consulta sin persistencia completada para ${placa}`);
      res.json(respuesta);
      
    } else {
      console.log(`❌ Error en consulta sin persistencia para ${placa}: ${resultado.message}`);
      res.status(422).json({
        placa: placa,
        consultado_en: new Date().toISOString(),
        error: resultado.message || 'Error en la consulta',
        raw_data: resultado,
        persistencia: false,
        mensaje: 'Consulta falló (sin guardar en base de datos)'
      });
    }
    
  } catch (error) {
    console.error(`❌ Error general en consulta sin persistencia para ${placa}:`, error.message);
    res.status(500).json({ 
      placa: placa,
      consultado_en: new Date().toISOString(),
      error: 'Error interno del servidor',
      details: error.message,
      persistencia: false,
      mensaje: 'Error interno (sin guardar en base de datos)'
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('❌ Error al cerrar navegador:', closeError.message);
      }
    }
  }
});

// Ruta para obtener historial de consultas de una placa
router.get('/historial-placa/:placa', authenticate, async (req, res) => {
  try {
    const { placa } = req.params;
    const limite = parseInt(req.query.limite) || 10;
    
    const historial = await consultaPlacaDB.obtenerHistorialConsultas(placa, limite);
    
    res.json({
      placa: placa,
      total_registros: historial.length,
      historial: historial
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo historial:', error.message);
    res.status(500).json({ 
      error: 'Error obteniendo historial de consultas',
      details: error.message 
    });
  }
});

// Ruta para obtener estadísticas generales
router.get('/estadisticas', authenticate, async (req, res) => {
  try {
    const estadisticas = await consultaPlacaDB.obtenerEstadisticas();
    
    res.json({
      timestamp: new Date().toISOString(),
      estadisticas: estadisticas
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error.message);
    res.status(500).json({ 
      error: 'Error obteniendo estadísticas',
      details: error.message 
    });
  }
});

// Ruta para probar conexión a base de datos
router.get('/test-db', authenticate, async (req, res) => {
  try {
    const { testConnection, getConnectionStatus } = require('../config/database');
    const conexionExitosa = await testConnection();
    
    if (conexionExitosa) {
      const estadisticas = await consultaPlacaDB.obtenerEstadisticas();
      res.json({
        database_connection: 'OK',
        timestamp: new Date().toISOString(),
        connection_status: getConnectionStatus(),
        estadisticas_rapidas: estadisticas
      });
    } else {
      res.status(500).json({
        database_connection: 'FAILED',
        timestamp: new Date().toISOString(),
        connection_status: getConnectionStatus(),
        mensaje: 'No se pudo conectar a la base de datos'
      });
    }
    
  } catch (error) {
    console.error('❌ Error en test de DB:', error.message);
    res.status(500).json({ 
      database_connection: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString(),
      connection_status: require('../config/database').getConnectionStatus()
    });
  }
});

// Ruta para obtener estado detallado de la base de datos
router.get('/db-status', authenticate, async (req, res) => {
  try {
    const { getConnectionStatus, testConnection } = require('../config/database');
    const { verificarDB } = require('../services/placa');
    
    const statusDB = getConnectionStatus();
    const testActual = await testConnection();
    const testPlaca = await verificarDB();
    
    res.json({
      timestamp: new Date().toISOString(),
      database_status: {
        connection_info: statusDB,
        test_directo: testActual,
        test_desde_placa: testPlaca,
        recomendacion: testActual ? 
          'Base de datos funcionando correctamente' : 
          'Revisar configuración de base de datos'
      }
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo status de DB:', error.message);
    res.status(500).json({
      timestamp: new Date().toISOString(),
      error: error.message,
      database_status: require('../config/database').getConnectionStatus()
    });
  }
});

// � Ruta para obtener estadísticas por lotes
router.get('/estadisticas-lotes', authenticate, async (req, res) => {
  try {
    const limite = parseInt(req.query.limite) || 10;
    const estadisticas = await consultaPlacaDB.obtenerEstadisticasPorLote(limite);
    
    res.json({
      timestamp: new Date().toISOString(),
      estadisticas_por_lote: estadisticas,
      total_lotes: estadisticas.length,
      limite_aplicado: limite
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas por lote:', error.message);
    res.status(500).json({
      error: 'Error obteniendo estadísticas por lote',
      mensaje: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 🔍 Ruta para obtener consultas de un lote específico por hora de ejecución
router.get('/lote/:horaEjecucion', authenticate, async (req, res) => {
  try {
    const horaEjecucion = new Date(req.params.horaEjecucion);
    
    if (isNaN(horaEjecucion.getTime())) {
      return res.status(400).json({
        error: 'Hora de ejecución inválida',
        mensaje: 'Por favor proporciona una hora de ejecución válida en formato ISO'
      });
    }
    
    const consultas = await consultaPlacaDB.obtenerConsultasPorLote(horaEjecucion);
    
    res.json({
      timestamp: new Date().toISOString(),
      hora_ejecucion_lote: horaEjecucion.toISOString(),
      total_consultas: consultas.length,
      consultas: consultas
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo consultas del lote:', error.message);
    res.status(500).json({
      error: 'Error obteniendo consultas del lote',
      mensaje: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// �🚀 Endpoint de estado general del sistema
router.get('/system-status', authenticate, async (req, res) => {
  try {
    console.log('🔍 Verificando estado general del sistema...');
    
    const systemStatus = {
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      environment: process.env.NODE_ENV || 'development',
      components: {
        api: {
          status: "OK",
          message: "API funcionando correctamente",
          uptime: process.uptime()
        },
        database: {
          status: "CHECKING",
          message: "Verificando conexión..."
        },
        consultation: {
          status: "CHECKING", 
          message: "Verificando servicio de consultas..."
        }
      },
      endpoints: {
        consultation_with_persistence: "/api/consulta-placa",
        consultation_without_persistence: "/api/consulta-placa-solo",
        batch_consultation: "/api/consulta-placa-sync",
        database_test: "/api/test-db",
        database_status: "/api/db-status",
        batch_statistics: "/api/estadisticas-lotes",
        batch_details: "/api/lote/:horaEjecucion"
      }
    };
    
    // Verificar base de datos
    try {
      const { testConnection } = require('../config/database');
      const dbTest = await testConnection();
      
      systemStatus.components.database = {
        status: dbTest ? "OK" : "ERROR",
        message: dbTest ? "PostgreSQL conectado correctamente" : "Error de conexión a PostgreSQL",
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        last_check: new Date().toISOString()
      };
    } catch (error) {
      systemStatus.components.database = {
        status: "ERROR",
        message: `Error: ${error.message}`,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        last_check: new Date().toISOString()
      };
    }
    
    // Verificar servicio de consultas
    try {
      const testPlaca = "EI2430"; // Placa de prueba
      const resultado = await consultarPorPlacaSoloConsulta(testPlaca);
      
      systemStatus.components.consultation = {
        status: "OK",
        message: "Servicio de consultas funcionando",
        test_plate: testPlaca,
        test_result: resultado,
        last_check: new Date().toISOString()
      };
    } catch (error) {
      systemStatus.components.consultation = {
        status: "ERROR", 
        message: `Error en consultas: ${error.message}`,
        last_check: new Date().toISOString()
      };
    }
    
    // Determinar estado general
    const dbOk = systemStatus.components.database.status === "OK";
    const consultaOk = systemStatus.components.consultation.status === "OK";
    
    systemStatus.overall_status = consultaOk ? 
      (dbOk ? "FULL_OPERATIONAL" : "PARTIAL_OPERATIONAL") : 
      "DEGRADED";
      
    systemStatus.capabilities = {
      single_consultation: consultaOk,
      batch_consultation: consultaOk,
      data_persistence: dbOk,
      n8n_ready: consultaOk
    };
    
    systemStatus.recommendations = [];
    if (!dbOk) {
      systemStatus.recommendations.push("⚠️ Base de datos no disponible - Persistencia deshabilitada");
      systemStatus.recommendations.push("✅ Usar endpoint /consulta-placa-solo para consultas sin persistencia");
    }
    if (!consultaOk) {
      systemStatus.recommendations.push("❌ Servicio de consultas no funcional - Revisar configuración");
    }
    if (dbOk && consultaOk) {
      systemStatus.recommendations.push("✅ Sistema completamente operativo");
    }
    
    res.json(systemStatus);
    
  } catch (error) {
    console.error('❌ Error verificando estado del sistema:', error);
    res.status(500).json({
      timestamp: new Date().toISOString(),
      overall_status: "ERROR",
      error: error.message,
      message: "Error interno verificando estado del sistema"
    });
  }
});

module.exports = router;
