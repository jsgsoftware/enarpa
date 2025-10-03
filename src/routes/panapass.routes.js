const express = require('express');
const authenticate = require('../middleware/auth');
const { launchBrowser, preparePage } = require('../services/browser');
const { consultarSaldo } = require('../services/panapass');

const router = express.Router();

router.post('/consulta', authenticate, async (req, res) => {
  const listaPanapass = req.body.panapass;
  if (!Array.isArray(listaPanapass) || listaPanapass.length === 0) {
    return res.status(400).json({ error: 'Debes enviar un array con los números Panapass' });
  }
  const browser = await launchBrowser();
  const page = await preparePage(browser);
  const resultados = { consultados: [], errores: [] };
  for (const numero of listaPanapass) {
    try {
      const result = await consultarSaldo(page, numero);
      if (result.success) {
        resultados.consultados.push({
          panapass: result.panapass,
          saldo: parseFloat(result.saldo)
        });
      } else {
        resultados.errores.push({ panapass: numero, error: result.message });
      }
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.error(`❌ Error en ${numero}:`, err.message);
      resultados.errores.push({ panapass: numero, error: 'Error inesperado en la consulta' });
    }
  }
  await browser.close();
  res.json(resultados);
});

module.exports = router;
