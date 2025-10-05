const { Pool } = require('pg');

// Configuración de la base de datos PostgreSQL
const dbConfig = {
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || '$An1od3iBuf4l0#',
  // Usar host externo si no puede resolver el interno
  host: process.env.DB_HOST || '138.199.156.99', // Host externo de EasyPanel
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'applabs',
  // Configuración mejorada para conexiones remotas
  max: 10, // máximo número de conexiones en el pool
  idleTimeoutMillis: 10000, // cerrar conexiones inactivas después de 10 segundos
  connectionTimeoutMillis: 5000, // tiempo de espera para obtener una conexión (5 segundos)
  acquireTimeoutMillis: 5000, // tiempo para adquirir conexión
  statement_timeout: 10000, // timeout para statements SQL (10 segundos)
  query_timeout: 10000, // timeout para queries (10 segundos)
  // Configuración SSL para conexiones remotas
  ssl: false, // EasyPanel PostgreSQL no soporta SSL
};

// Crear pool de conexiones
const pool = new Pool(dbConfig);

// Variable para tracking del estado de conexión
let conexionDisponible = false;
let ultimaVerificacion = 0;
const INTERVALO_VERIFICACION = 30000; // 30 segundos

// Evento para manejar errores del pool
pool.on('error', (err, client) => {
  console.error('❌ Error inesperado en cliente de PostgreSQL:', err.message);
  conexionDisponible = false;
});

// Función para probar la conexión con timeout
async function testConnection() {
  const ahora = Date.now();
  
  // Si verificamos hace poco y estaba disponible, asumir que sigue así
  if (conexionDisponible && (ahora - ultimaVerificacion) < INTERVALO_VERIFICACION) {
    return true;
  }
  
  try {
    const client = await Promise.race([
      pool.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 3000)
      )
    ]);
    
    const result = await Promise.race([
      client.query('SELECT NOW()'),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 2000)
      )
    ]);
    
    client.release();
    
    console.log('✅ Conexión a PostgreSQL exitosa:', result.rows[0]);
    conexionDisponible = true;
    ultimaVerificacion = ahora;
    return true;
  } catch (error) {
    console.error('❌ Error conectando a PostgreSQL:', error.message);
    conexionDisponible = false;
    ultimaVerificacion = ahora;
    return false;
  }
}

// Función para ejecutar queries con timeout
async function query(text, params) {
  const start = Date.now();
  
  if (!conexionDisponible) {
    const conectado = await testConnection();
    if (!conectado) {
      throw new Error('Base de datos no disponible');
    }
  }
  
  try {
    const result = await Promise.race([
      pool.query(text, params),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 5s')), 5000)
      )
    ]);
    
    const duration = Date.now() - start;
    console.log(`📊 Query ejecutado en ${duration}ms:`, text.substring(0, 50) + '...');
    return result;
  } catch (error) {
    console.error('❌ Error en query:', error.message);
    console.error('Query:', text.substring(0, 100) + '...');
    console.error('Params:', params);
    
    // Si es timeout o error de conexión, marcar DB como no disponible
    if (error.message.includes('timeout') || 
        error.message.includes('Connection terminated') ||
        error.message.includes('ECONNREFUSED')) {
      conexionDisponible = false;
    }
    
    throw error;
  }
}

// Función para obtener un cliente del pool (para transacciones)
async function getClient() {
  if (!conexionDisponible) {
    const conectado = await testConnection();
    if (!conectado) {
      throw new Error('Base de datos no disponible para transacciones');
    }
  }
  
  return await Promise.race([
    pool.connect(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Client timeout')), 3000)
    )
  ]);
}

// Función para obtener el estado de la conexión
function getConnectionStatus() {
  return {
    disponible: conexionDisponible,
    ultima_verificacion: new Date(ultimaVerificacion).toISOString(),
    config: {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user
    }
  };
}

module.exports = {
  pool,
  query,
  getClient,
  testConnection,
  getConnectionStatus
};