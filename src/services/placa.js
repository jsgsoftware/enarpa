async function consultarPorPlaca(page, plate) {
  console.log(`🚗 Consultando Placa: ${plate}`);
  return await page.evaluate(async (placa) => {
    const token = await new Promise((resolve, reject) => {
      grecaptcha.ready(() => {
        grecaptcha.execute()
          .then(resolve)
          .catch(reject);
      });
    });

    const resp = await fetch('/api/v2/test/get-morosidad-tag/json', {
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

    const data = await resp.json();
    return { plate: placa, ...data };
  }, plate);
}

module.exports = { consultarPorPlaca };
