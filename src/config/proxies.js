// Configuración de proxies para rotación de IP
// Puedes agregar proxies aquí si los tienes disponibles

const PROXY_LIST = [
  // Ejemplos de formato (descomenta y añade tus proxies reales):
  // 'http://proxy1.example.com:8080',
  // 'http://proxy2.example.com:8080',
  // 'socks5://proxy3.example.com:1080',
  
  // Para proxies con autenticación:
  // 'http://usuario:password@proxy.example.com:8080'
];

// Función para obtener un proxy aleatorio
function getRandomProxy() {
  if (PROXY_LIST.length === 0) {
    return null;
  }
  return PROXY_LIST[Math.floor(Math.random() * PROXY_LIST.length)];
}

// Función para verificar si hay proxies configurados
function hasProxies() {
  return PROXY_LIST.length > 0;
}

module.exports = {
  PROXY_LIST,
  getRandomProxy,
  hasProxies
};