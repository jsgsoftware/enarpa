// Test del formato de hora
console.log('🔍 Probando formato de hora...');

const ahora = new Date();
console.log('Fecha completa:', ahora);

// Generar hora en formato HH:MM
const horaEjecucionLote = `${ahora.getHours().toString().padStart(2, '0')}:${ahora.getMinutes().toString().padStart(2, '0')}`;
console.log('Hora simplificada:', horaEjecucionLote);
console.log('Longitud:', horaEjecucionLote.length);

// Ejemplos
console.log('\nEjemplos:');
const fechas = [
  new Date('2025-10-04T09:30:45.123Z'),
  new Date('2025-10-04T14:05:12.456Z'),
  new Date('2025-10-04T23:59:59.999Z')
];

fechas.forEach(fecha => {
  const horaFormato = `${fecha.getHours().toString().padStart(2, '0')}:${fecha.getMinutes().toString().padStart(2, '0')}`;
  console.log(`${fecha.toISOString()} -> ${horaFormato} (${horaFormato.length} chars)`);
});