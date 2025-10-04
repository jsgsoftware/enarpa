const express = require('express');
const authenticate = require('../middleware/auth');
const { launchBrowser, preparePage, randomDelay } = require('../services/browser');
const { consultarPorPlaca } = require('../services/placa');

const router = express.Router();

router.post('/consulta-placa', authenticate, async (req, res) => {
  const listaPlacas = req.body.placas;
  if (!Array.isArray(listaPlacas) || listaPlacas.length === 0) {
    return res.status(400).json({ error: 'Debes enviar un array con las placas a consultar' });
  }

  let browser = null;
  let page = null;

  try {
    // Lanzar browser con configuración anti-detección
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
        
        // Delay aleatorio entre consultas para parecer más humano
        const delay = randomDelay(2000, 5000);
        console.log(`⏱️ Esperando ${delay}ms antes de la siguiente consulta...`);
        await new Promise(r => setTimeout(r, delay));
        
      } catch (err) {
        console.error(`❌ Error en ${placa}:`, err.message);
        resultados.errores.push({ plate: placa, error: 'Error inesperado en la consulta' });
        
        // Si hay demasiados errores, podríamos necesitar reiniciar el navegador
        if (resultados.errores.length > 3) {
          console.log('🔄 Demasiados errores, reiniciando navegador...');
          try {
            await browser.close();
            browser = await launchBrowser();
            page = await preparePage(browser);
          } catch (restartError) {
            console.error('❌ Error al reiniciar navegador:', restartError.message);
            break;
          }
        }
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

module.exports = router;
