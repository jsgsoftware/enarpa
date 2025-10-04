// Estrategias adicionales para evitar detección y bloqueos

// Simulación de comportamiento humano
async function simulateHumanBehavior(page) {
  try {
    // Movimiento aleatorio del mouse
    await page.mouse.move(
      Math.floor(Math.random() * 800), 
      Math.floor(Math.random() * 600)
    );
    
    // Scroll aleatorio
    await page.evaluate(() => {
      window.scrollBy(0, Math.floor(Math.random() * 300));
    });
    
    // Delay corto
    await new Promise(r => setTimeout(r, Math.random() * 1000 + 500));
    
  } catch (error) {
    console.warn('⚠️ Error en simulación humana:', error.message);
  }
}

// Función para reintentar operaciones con backoff exponencial
async function retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.warn(`⚠️ Intento ${attempt}/${maxRetries} falló:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.log(`⏳ Esperando ${Math.round(delay)}ms antes del siguiente intento...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// Función para limpiar cookies y caché
async function clearBrowserData(page) {
  try {
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await client.send('Network.clearBrowserCache');
    console.log('🧹 Datos del navegador limpiados');
  } catch (error) {
    console.warn('⚠️ Error al limpiar datos:', error.message);
  }
}

// Función para rotar headers
function getRandomHeaders() {
  const acceptLanguages = [
    'es-ES,es;q=0.9,en;q=0.8',
    'es-PA,es;q=0.9,en;q=0.8',
    'es-MX,es;q=0.9,en;q=0.8',
    'es-CO,es;q=0.9,en;q=0.8'
  ];
  
  return {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': acceptLanguages[Math.floor(Math.random() * acceptLanguages.length)],
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': Math.random() > 0.5 ? '1' : '0',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0'
  };
}

module.exports = {
  simulateHumanBehavior,
  retryWithBackoff,
  clearBrowserData,
  getRandomHeaders
};