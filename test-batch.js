const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3000';
const AUTH_HEADERS = {
  'x-client-id': 'mi_cliente_super_seguro',
  'x-client-secret': 'mi_secreto_super_seguro',
  'Content-Type': 'application/json'
};

// Placas de ejemplo para testing
const placasPrueba = [
  'EI2430', 'EI2431', 'EI2432', 'EI2433', 'EI2438'
];

const placasMasivas = [
  'EI2430', 'EI2431', 'EI2432', 'EI2433', 'EI2438', 'EI2439',
  'EK5464', 'EK5465', 'EK5466', 'EK5467', 'EK5468', 'EK5469',
  'EL3928', 'EL3929', 'EL3930', 'EL3931', 'EL3932', 'EL3933'
];

async function testConsultaSync() {
  console.log('🔬 Probando consulta síncrona (pocas placas)...');
  
  try {
    const response = await axios.post(`${BASE_URL}/api/consulta-placa-sync`, {
      placas: placasPrueba
    }, {
      headers: AUTH_HEADERS,
      timeout: 60000 // 1 minuto
    });
    
    console.log('✅ Respuesta síncrona recibida:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error en consulta síncrona:', error.message);
    if (error.response) {
      console.error('Detalles:', error.response.data);
    }
  }
}

async function testConsultaAsync() {
  console.log('🔬 Probando consulta asíncrona (muchas placas)...');
  
  try {
    // Iniciar procesamiento asíncrono
    const response = await axios.post(`${BASE_URL}/api/consulta-placa`, {
      placas: placasMasivas
    }, {
      headers: AUTH_HEADERS,
      timeout: 10000 // 10 segundos para la respuesta inicial
    });
    
    console.log('✅ Respuesta inicial recibida:');
    console.log(JSON.stringify(response.data, null, 2));
    
    const requestId = response.data.requestId;
    
    // Monitorear progreso
    console.log('\n📊 Monitoreando progreso...');
    let completed = false;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutos máximo
    
    while (!completed && attempts < maxAttempts) {
      try {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar 5 segundos
        
        const statusResponse = await axios.get(`${BASE_URL}/api/consulta-status/${requestId}`, {
          headers: AUTH_HEADERS
        });
        
        const status = statusResponse.data;
        console.log(`📈 Progreso: ${status.procesados}/${status.total} (${status.status})`);
        
        if (status.status === 'completed' || status.status === 'error') {
          completed = true;
          console.log('\n✅ Resultado final:');
          console.log(JSON.stringify(status, null, 2));
        }
        
        attempts++;
        
      } catch (statusError) {
        console.error('❌ Error consultando status:', statusError.message);
        break;
      }
    }
    
    if (!completed) {
      console.log('⏰ Timeout: El procesamiento puede estar tomando más tiempo del esperado');
    }
    
  } catch (error) {
    console.error('❌ Error en consulta asíncrona:', error.message);
    if (error.response) {
      console.error('Detalles:', error.response.data);
    }
  }
}

async function main() {
  console.log('🚀 Iniciando pruebas del sistema optimizado...\n');
  
  // Probar consulta síncrona primero
  await testConsultaSync();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Luego probar consulta asíncrona
  await testConsultaAsync();
  
  console.log('\n🏁 Pruebas completadas');
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testConsultaSync,
  testConsultaAsync
};