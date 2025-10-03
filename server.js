import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // ⚠️ solo para pruebas

// ----------- Middleware de autenticación -----------
function authenticate(req, res, next) {
  const clientId = req.headers['x-client-id'];
  const clientSecret = req.headers['x-client-secret'];

  if (
    clientId === process.env.CLIENT_ID &&
    clientSecret === process.env.CLIENT_SECRET
  ) {
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized' });
}

// ----------- Función para consultar un Panapass -----------
async function consultarSaldo(page, panapass) {
  console.log(`🔎 Consultando Panapass: ${panapass}`);

  const data = await page.evaluate(async (panapass) => {
    const token = await new Promise((resolve, reject) => {
      grecaptcha.ready(() => {
        grecaptcha.execute()
          .then(resolve)
          .catch(reject);
      });
    });

    const resp = await fetch('/api/v2/get-saldo-panapass/json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: new URLSearchParams({
        panapass: panapass,
        captcha_token: token
      })
    });

    return await resp.json();
  }, panapass);

  return { panapass, ...data };
}

// ----------- Endpoint protegido -----------
app.post('/api/consulta', authenticate, async (req, res) => {
  const listaPanapass = req.body.panapass;

  if (!Array.isArray(listaPanapass) || listaPanapass.length === 0) {
    return res.status(400).json({ error: 'Debes enviar un array con los números Panapass' });
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  });

  const page = await browser.newPage();
  await page.goto('https://ena.com.pa/consulta-tu-saldo', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => typeof grecaptcha !== 'undefined');

  console.log('✅ grecaptcha cargado');

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
        resultados.errores.push({
          panapass: numero,
          error: result.message
        });
      }

      await new Promise(r => setTimeout(r, 1500)); // delay entre consultas
    } catch (err) {
      resultados.errores.push({ panapass: numero, error: 'Error inesperado en la consulta' });
    }
  }

  await browser.close();

  res.json(resultados);
});

// ----------- Iniciar servidor -----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API corriendo en http://localhost:${PORT}`);
});
