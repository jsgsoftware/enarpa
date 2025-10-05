console.log('🔍 Verificando exportación del servicio...');

try {
  const consultaPlacaDB = require('./src/services/consultaPlacaDB');
  
  console.log('✅ Módulo importado correctamente');
  console.log('📋 Funciones disponibles:');
  console.log('- procesarYGuardarConsulta:', typeof consultaPlacaDB.procesarYGuardarConsulta);
  console.log('- obtenerEstadisticas:', typeof consultaPlacaDB.obtenerEstadisticas);
  console.log('- obtenerHistorialConsultas:', typeof consultaPlacaDB.obtenerHistorialConsultas);
  console.log('- obtenerConsultasPorLote:', typeof consultaPlacaDB.obtenerConsultasPorLote);
  console.log('- obtenerEstadisticasPorLote:', typeof consultaPlacaDB.obtenerEstadisticasPorLote);
  
  // Verificar si es una instancia de clase
  console.log('🔧 Tipo del objeto:', typeof consultaPlacaDB);
  console.log('🔧 Constructor:', consultaPlacaDB.constructor.name);
  
} catch (error) {
  console.error('❌ Error importando módulo:', error.message);
  console.error(error.stack);
}