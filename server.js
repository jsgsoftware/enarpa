// Bootstrap principal de la API
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Carga variables de entorno
dotenv.config();

// App
const app = express();
app.use(cors());
app.use(express.json());

// (Opcional) Permitir certificados inseguros SOLO en dev
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// Rutas
const panapassRouter = require('./src/routes/panapass.routes');
const placaRouter = require('./src/routes/placa.routes');

app.use('/api', panapassRouter);
app.use('/api', placaRouter);

// Healthcheck simple
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Inicio del servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API corriendo en http://localhost:${PORT}`);
});

module.exports = app;
