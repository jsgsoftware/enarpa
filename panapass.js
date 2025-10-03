const puppeteer = require('puppeteer');

async function consultarMultiplesSaldos(numeros) {
  const browser = await puppeteer.launch({
    headless: false,                 // pon false para ver el navegador
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  const page = await browser.newPage();

  // Ir al sitio de ENA
  await page.goto('https://ena.com.pa/consulta-tu-saldo/', {
    waitUntil: 'networkidle2'
  });

  console.log('✅ Página cargada correctamente');

  // Click en el botón "Consulta tu Saldo" usando el selector correcto (solo la primera vez)
  await page.waitForSelector('#boton-open-consulta', { timeout: 10000 });
  console.log('✅ Botón "Consulta tu Saldo" encontrado');
  
  await page.click('#boton-open-consulta');
  console.log('✅ Click en "Consulta tu Saldo" realizado');

  const resultados = [];

  for (let i = 0; i < numeros.length; i++) {
    const numero = numeros[i];
    console.log(`\n🔍 Consultando ${numero} (${i + 1}/${numeros.length})...`);

    try {
      // Esperar que aparezca el input del número de panapass
      await page.waitForSelector('#saldo-input', { timeout: 10000 });
      console.log('✅ Input de saldo encontrado');

      // Esperar un poco más para que el modal esté completamente cargado
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Asegurar que el input esté visible y hacer foco
      await page.focus('#saldo-input');
      
      // Limpiar cualquier contenido previo
      await page.evaluate(() => {
        const input = document.querySelector('#saldo-input');
        if (input) {
          input.value = '';
        }
      });
      
      // Escribir el número Panapass
      await page.type('#saldo-input', numero.toString(), { delay: 100 });
      console.log(`✅ Número ${numero} ingresado correctamente`);

      // Buscar y hacer click en el botón "Consultar"
      await page.waitForSelector('#boton-consultar', { timeout: 20000 });
      console.log('✅ Botón "Consultar" encontrado');
      
      await page.click('#boton-consultar');
      console.log('✅ Click en "Consultar" realizado');

      // Esperar específicamente hasta que aparezca el saldo
      console.log('⏳ Esperando hasta que aparezca el saldo...');
      
      // Para consultas después de la primera, agregar MUCHO más tiempo de espera
      if (i > 0) {
        console.log('⏳ Consulta subsecuente - esperando 15 segundos adicionales...');
        await new Promise(resolve => setTimeout(resolve, 15000)); // 15 segundos extra para consultas subsecuentes
      }
      
      await page.waitForFunction(
        () => {
          // Buscar específicamente que aparezca un elemento con ID consultaSaldo que contenga "B/."
          const saldoElement = document.querySelector('#consultaSaldo');
          if (saldoElement && saldoElement.innerText && saldoElement.innerText.includes('B/.')) {
            return true;
          }
          
          // También buscar el texto "Saldo Consultado" que aparece primero
          const bodyText = document.body.innerText;
          if (bodyText.includes('Saldo Consultado') && bodyText.includes('B/.')) {
            return true;
          }
          
          // Verificar si hay algún mensaje de error o número inválido
          if (bodyText.includes('no válido') || bodyText.includes('Error') || bodyText.includes('incorrecto')) {
            return true;
          }
          
          return false;
        },
        { 
          timeout: 120000, // 2 minutos de timeout para consultas subsecuentes
          polling: 3000    // Verificar cada 3 segundos
        }
      );
      
      console.log('✅ Respuesta detectada disponible');

      // Extraer la información del saldo
      const resultado = await page.evaluate((numeroOriginal) => {
        const bodyText = document.body.innerText;
        
        // Verificar si hay mensajes de error
        if (bodyText.includes('no válido') || bodyText.includes('Error') || bodyText.includes('incorrecto')) {
          return {
            numero: numeroOriginal,
            saldoCompleto: 'Número inválido',
            cantidad: 0,
            texto: `Panapass: ${numeroOriginal} - Error: Número inválido`
          };
        }
        
        // Buscar número de panapass (10 dígitos)
        const numeroMatch = bodyText.match(/(\d{10})/);
        const numero = numeroMatch ? numeroMatch[1] : numeroOriginal;
        
        // Buscar saldo
        const saldoMatch = bodyText.match(/B\/\.(\d+\.\d+)/);
        const saldoCompleto = saldoMatch ? `B/.${saldoMatch[1]}` : 'No encontrado';
        const cantidadNumerica = saldoMatch ? parseFloat(saldoMatch[1]) : 0;
        
        return {
          numero: numero,
          saldoCompleto: saldoCompleto,
          cantidad: cantidadNumerica,
          texto: `Panapass: ${numero} - Saldo: ${saldoCompleto} - Cantidad: ${cantidadNumerica}`
        };
      }, numero);

      console.log(`✅ Saldo extraído: ${resultado.texto}`);

      resultados.push({
        numero: resultado.numero,
        saldoCompleto: resultado.saldoCompleto,
        cantidad: resultado.cantidad
      });

      // Si no es la última consulta, hacer click en "Listo" para volver al formulario
      if (i < numeros.length - 1) {
        console.log('🔄 Haciendo click en "Listo" para nueva consulta...');
        
        await page.waitForSelector('#boton-listo', { timeout: 10000 });
        await page.click('#boton-listo');
        console.log('✅ Click en "Listo" realizado');
        
        // Simplemente esperar a que el input esté disponible nuevamente
        console.log('⏳ Esperando a que el input esté disponible...');
        await page.waitForSelector('#saldo-input', { timeout: 15000 });
        console.log('✅ Input disponible para la siguiente consulta');
        
        // Pausa más larga para asegurar que esté completamente listo
        await new Promise(resolve => setTimeout(resolve, 3000)); // Aumentado a 3 segundos
      }

    } catch (err) {
      console.error(`❌ Error consultando ${numero}:`, err.message);
      resultados.push({ 
        numero: numero, 
        saldoCompleto: 'Error',
        cantidad: 0
      });
    }
  }

  // Cerrar el navegador al final de todas las consultas
  console.log('\n🔚 Todas las consultas completadas, cerrando navegador...');
  await browser.close();

  return resultados;
}

async function main() {
  // Lista de números Panapass
  const numeros = [
    '0000217559',
    '0000797146',
    '0000000001'
  ];

  console.log(`🚀 Iniciando consulta de ${numeros.length} números Panapass...`);

  try {
    const resultados = await consultarMultiplesSaldos(numeros);

    console.log('\n📊 Resultados finales:');
    console.table(resultados);

    // Ejemplo de cálculos con las cantidades numéricas
    const totalSaldos = resultados.reduce((sum, item) => sum + (item.cantidad || 0), 0);
    const cantidadConsultas = resultados.filter(item => item.cantidad > 0).length;
    const promedioSaldo = cantidadConsultas > 0 ? (totalSaldos / cantidadConsultas) : 0;

    console.log('\n🧮 Cálculos:');
    console.log(`💰 Total en saldos: B/.${totalSaldos.toFixed(2)}`);
    console.log(`📈 Promedio por tarjeta: B/.${promedioSaldo.toFixed(2)}`);
    console.log(`🔢 Tarjetas consultadas exitosamente: ${cantidadConsultas}`);
    console.log(`📋 Total de consultas realizadas: ${numeros.length}`);

  } catch (err) {
    console.error('❌ Error general:', err.message);
  }
}

main();
