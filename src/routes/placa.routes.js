const express = require('express');
const authenticate = require('../middleware/auth');
const { launchBrowser, preparePage } = require('../services/browser');
const { consultarPorPlaca } = require('../services/placa');

const router = express.Router();

router.post('/consulta-placa', authenticate, async (req, res) => {
  const listaPlacas = req.body.placas;
  if (!Array.isArray(listaPlacas) || listaPlacas.length === 0) {
    return res.status(400).json({ error: 'Debes enviar un array con las placas a consultar' });
  }
  const browser = await launchBrowser();
  const page = await preparePage(browser);
  const resultados = { consultados: [], errores: [] };
  for (const placa of listaPlacas) {
    try {
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
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.error(`❌ Error en ${placa}:`, err.message);
      resultados.errores.push({ plate: placa, error: 'Error inesperado en la consulta' });
    }
  }
  await browser.close();
  res.json(resultados);
});

module.exports = router;
