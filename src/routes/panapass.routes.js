const express = require('express');
const authenticate = require('../middleware/auth');
const { createBrowserSession, safeCloseBrowserSession, markBrowserSessionError, markBrowserSessionSuccess } = require('../services/browser');
const { consultarSaldo } = require('../services/panapass');

const router = express.Router();

router.post('/consulta', authenticate, async (req, res) => {
  const listaPanapass = req.body.panapass;
  if (!Array.isArray(listaPanapass) || listaPanapass.length === 0) {
    return res.status(400).json({ error: 'Debes enviar un array con los números Panapass' });
  }
  let session = null;

  try {
    session = await createBrowserSession({
      label: 'panapass|consulta',
      metadata: { total: listaPanapass.length }
    });
    const resultados = { consultados: [], errores: [] };

    for (const numero of listaPanapass) {
      try {
        const result = await consultarSaldo(session.page, numero);
        if (result.success) {
          resultados.consultados.push({
            panapass: result.panapass,
            saldo: parseFloat(result.saldo)
          });
        } else {
          resultados.errores.push({ panapass: numero, error: result.message });
        }
        markBrowserSessionSuccess(session, { incrementPlates: 1, panapass: numero });
        await new Promise(r => setTimeout(r, 1500));
      } catch (err) {
        console.error(`❌ Error en ${numero}:`, err.message);
        markBrowserSessionError(session, err, { panapass: numero });
        resultados.errores.push({ panapass: numero, error: 'Error inesperado en la consulta' });
      }
    }

    markBrowserSessionSuccess(session, { incrementBatches: 1 });

    res.json(resultados);
  } finally {
    await safeCloseBrowserSession(session, 'panapass');
  }
});

module.exports = router;
