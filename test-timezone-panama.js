const { obtenerFechaPanama, obtenerHoraPanamaFormato, obtenerFechaPanamaISO, debugTimezone } = require('./src/utils/timezone');

console.log('🧪 Test de zona horaria de Panamá\n');

// Mostrar información de debug
debugTimezone();

console.log('\n📊 Comparación detallada:');
const ahora = new Date();
const fechaPanama = obtenerFechaPanama();

console.log(`🌍 Hora del servidor:`);
console.log(`   Completa: ${ahora.toString()}`);
console.log(`   ISO: ${ahora.toISOString()}`);
console.log(`   Offset: ${ahora.getTimezoneOffset()} minutos`);

console.log(`\n🇵🇦 Hora de Panamá:`);
console.log(`   Completa: ${fechaPanama.toString()}`);
console.log(`   ISO: ${fechaPanama.toISOString()}`);
console.log(`   Formato HH:MM: ${obtenerHoraPanamaFormato()}`);
console.log(`   ISO directo: ${obtenerFechaPanamaISO()}`);

console.log(`\n⏰ Diferencia:`);
const diferenciaHoras = Math.abs(ahora.getTime() - fechaPanama.getTime()) / (1000 * 60 * 60);
console.log(`   ${diferenciaHoras} horas`);

console.log(`\n✅ El formato que se guardará como hora_ejecucion: "${obtenerHoraPanamaFormato()}"`);