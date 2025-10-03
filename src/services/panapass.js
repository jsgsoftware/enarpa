async function consultarSaldo(page, panapass) {
  console.log(`🔎 Consultando Panapass: ${panapass}`);
  return await page.evaluate(async (num) => {
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
        panapass: num,
        captcha_token: token
      })
    });

    const data = await resp.json();
    return { panapass: num, ...data };
  }, panapass);
}

module.exports = { consultarSaldo };
