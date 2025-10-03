import puppeteer from 'puppeteer';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // ⚠️ Solo para pruebas locales

async function consultarSaldo(page, panapass) {
  console.log(`\n🔎 Consultando Panapass: ${panapass}`);

  const data = await page.evaluate(async (panapass) => {
    const token = await new Promise((resolve, reject) => {
      grecaptcha.ready(() => {
        grecaptcha.execute()
          .then(resolve)
          .catch(reject);
      });
    });

    console.log('🔑 Token:', token.substring(0, 50) + '...');

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

async function main() {
  const panapassList = [
    '217559',
    '797146',
    '123456',
    '654321',
    '999999' // ejemplo con error
  ];

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('https://ena.com.pa/consulta-tu-saldo', { waitUntil: 'networkidle2' });

  await page.waitForFunction(() => typeof grecaptcha !== 'undefined');
  console.log('✅ grecaptcha cargado');

  // Arrays para clasificar los resultados
  const exitos = [];
  const errores = [];

  for (const panapass of panapassList) {
    const result = await consultarSaldo(page, panapass);

    if (result.success) {
      console.log(`✅ Saldo de ${result.panapass}: B/. ${result.saldo}`);
      exitos.push({
        panapass: result.panapass,
        saldo: parseFloat(result.saldo)
      });
    } else {
      console.warn(`⚠️ Error consultando ${panapass}: ${result.message}`);
      errores.push({
        panapass: panapass,
        error: result.message
      });
    }

    await new Promise(r => setTimeout(r, 1500)); // Espera entre consultas
  }

  await browser.close();

  // Crear objeto final
  const salida = {
    consultados: exitos,
    errores: errores
  };

  console.log('\n📦 Resultado Final (JSON):');
  console.log(JSON.stringify(salida, null, 2));
}

main().catch(console.error);
