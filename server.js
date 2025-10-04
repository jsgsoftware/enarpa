// Bootstrap principal de la API
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Carga variables de entorno
dotenv.config();

// App
const app = express();

// Configurar timeouts más largos para el servidor
app.use((req, res, next) => {
  // Timeout de 10 minutos para requests largos
  req.setTimeout(600000);
  res.setTimeout(600000);
  next();
});

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Aumentar límite para arrays grandes

// (Opcional) Permitir certificados inseguros SOLO en dev
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// Middleware para logging de requests largos
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 5000) { // Log requests que tomen más de 5 segundos
      console.log(`🐌 Request lento: ${req.method} ${req.path} - ${duration}ms`);
    }
  });
  
  next();
});

// Rutas
const panapassRouter = require('./src/routes/panapass.routes');
const placaRouter = require('./src/routes/placa.routes');

app.use('/api', panapassRouter);
app.use('/api', placaRouter);

// Healthcheck simple
app.get('/health', (_req, res) => res.json({ 
  status: 'ok',
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
  memory: process.memoryUsage()
}));

// Endpoint para estadísticas del servidor
app.get('/stats', (_req, res) => {
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    version: process.version,
    platform: process.platform
  });
});

// Manejo de errores global
app.use((error, req, res, next) => {
  console.error('❌ Error no manejado:', error);
  
  if (error.code === 'TIMEOUT') {
    return res.status(408).json({ 
      error: 'Timeout en el procesamiento',
      message: 'La consulta está tomando más tiempo del esperado. Intenta con menos placas o usa el endpoint asíncrono.'
    });
  }
  
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: error.message
  });
});

// Inicio del servidor
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`🚀 API corriendo en http://localhost:${PORT}`);
  console.log(`📊 Stats disponibles en http://localhost:${PORT}/stats`);
  console.log(`💚 Health check en http://localhost:${PORT}/health`);
});

// Configurar timeouts del servidor
server.timeout = 600000; // 10 minutos
server.keepAliveTimeout = 650000; // 10.8 minutos
server.headersTimeout = 660000; // 11 minutos

// Manejo graceful de shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Recibida señal SIGTERM, cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Recibida señal SIGINT, cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

module.exports = app;
