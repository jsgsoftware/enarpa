const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3000';
const AUTH_HEADERS = {
  'x-client-id': 'mi_cliente_super_seguro',
  'x-client-secret': 'mi_secreto_super_seguro',
  'Content-Type': 'application/json'
};

async function testQuickSync() {
  console.log('🧪 Probando consulta síncrona rápida (2 placas)...');
  
  try {
    const response = await axios.post(`${BASE_URL}/api/consulta-placa-sync`, {
      placas: ['EI2430', 'EI2431']
    }, {
      headers: AUTH_HEADERS,
      timeout: 120000 // 2 minutos
    });
    
    console.log('✅ Respuesta recibida:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Detalles:', error.response.data);
    }
  }
}

testQuickSync();