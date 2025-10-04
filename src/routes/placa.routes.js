const express = require('express');
const authenticate = require('../middleware/auth');
const { launchBrowser, preparePage, randomDelay } = require('../services/browser');
const { consultarPorPlaca } = require('../services/placa');

const router = express.Router();

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
  const resultados = { 
    requestId,
    consultados: [], 
    errores: [],
    procesados: 0,
    total: listaPlacas.length,
    iniciado: new Date().toISOString(),
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
      
      try {
        // Reiniciar browser cada 3 lotes para evitar problemas de memoria
        if (!browser || i % 3 === 0) {
          if (browser) {
            console.log('🔄 Reiniciando navegador para mantener rendimiento...');
            await browser.close();
          }
          browser = await launchBrowser();
          page = await preparePage(browser);
        }
        
        // Procesar lote actual
        for (const placa of lote) {
          try {
            console.log(`🔍 [${requestId}] Consultando placa: ${placa} (${resultados.procesados + 1}/${listaPlacas.length})`);
            
            const result = await consultarPorPlaca(page, placa);
            
            if (result.success) {
              resultados.consultados.push({
                plate: placa,
                chkDefaulter: result.chkDefaulter,
                typeAccount: result.typeAccount,
                saldo: result.balanceAmount ? result.balanceAmount / 100 : 0,
                adeudado: result.totalAmount ? result.totalAmount / 100 : 0
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
    resultados.finalizado = new Date().toISOString();
    
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
    resultados.finalizado = new Date().toISOString();
    
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

  try {
    browser = await launchBrowser();
    page = await preparePage(browser);
    
    const resultados = { consultados: [], errores: [] };
    
    for (const placa of listaPlacas) {
      try {
        console.log(`🔍 Consultando placa: ${placa}`);
        
        const result = await consultarPorPlaca(page, placa);
        
        if (result.success) {
          resultados.consultados.push({
            plate: placa,
            chkDefaulter: result.chkDefaulter,
            typeAccount: result.typeAccount,
            saldo: result.balanceAmount ? result.balanceAmount / 100 : 0,
            adeudado: result.totalAmount ? result.totalAmount / 100 : 0
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

module.exports = router;
