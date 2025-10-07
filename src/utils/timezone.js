/**
 * Utilidades para manejo de zona horaria de Panamá
 * Panamá está en UTC-5 (EST) durante todo el año (no maneja horario de verano)
 */

/**
 * Obtiene la fecha y hora actual en zona horaria de Panamá
 * @returns {Date} Fecha ajustada a la zona horaria de Panamá
 */
function obtenerFechaPanama() {
  // Crear fecha actual UTC
  const utc = new Date();
  
  // Panamá está en UTC-5, así que restamos 5 horas
  const panamaTime = new Date(utc.getUTCFullYear(), 
                              utc.getUTCMonth(), 
                              utc.getUTCDate(), 
                              utc.getUTCHours() - 5, 
                              utc.getUTCMinutes(), 
                              utc.getUTCSeconds(), 
                              utc.getUTCMilliseconds());
  
  return panamaTime;
}

/**
 * Obtiene la hora actual de Panamá en formato HH:MM
 * @returns {string} Hora en formato HH:MM (ej: "14:30")
 */
function obtenerHoraPanamaFormato() {
  const fechaPanama = obtenerFechaPanama();
  const horas = fechaPanama.getHours().toString().padStart(2, '0');
  const minutos = fechaPanama.getMinutes().toString().padStart(2, '0');
  return `${horas}:${minutos}`;
}

/**
 * Obtiene la fecha y hora actual de Panamá en formato ISO
 * @returns {string} Fecha en formato ISO ajustada a Panamá
 */
function obtenerFechaPanamaISO() {
  return obtenerFechaPanama().toISOString();
}

/**
 * Convierte cualquier fecha a la zona horaria de Panamá
 * @param {Date} fecha - Fecha a convertir
 * @returns {Date} Fecha ajustada a la zona horaria de Panamá
 */
function convertirAZonaPanama(fecha) {
  // Panamá está en UTC-5, así que restamos 5 horas del UTC
  const panamaTime = new Date(fecha.getUTCFullYear(), 
                              fecha.getUTCMonth(), 
                              fecha.getUTCDate(), 
                              fecha.getUTCHours() - 5, 
                              fecha.getUTCMinutes(), 
                              fecha.getUTCSeconds(), 
                              fecha.getUTCMilliseconds());
  
  return panamaTime;
}

/**
 * Muestra información de debug sobre las zonas horarias
 */
function debugTimezone() {
  const ahora = new Date();
  const fechaPanama = obtenerFechaPanama();
  
  console.log('🕐 Debug Timezone:');
  console.log(`   Servidor: ${ahora.toISOString()} (offset: ${ahora.getTimezoneOffset()} min)`);
  console.log(`   Panamá:   ${fechaPanama.toISOString()} (UTC-5)`);
  console.log(`   Hora Panamá formato: ${obtenerHoraPanamaFormato()}`);
  console.log(`   Diferencia: ${Math.abs(ahora.getTime() - fechaPanama.getTime()) / (1000 * 60 * 60)} horas`);
}

module.exports = {
  obtenerFechaPanama,
  obtenerHoraPanamaFormato,
  obtenerFechaPanamaISO,
  convertirAZonaPanama,
  debugTimezone
};