const { Client } = require('pg');

console.log('🔧 Limpiando y cambiando tipo de campo hora_ejecucion...');

const client = new Client({
  host: '138.199.156.99',
  port: 5432,
  database: 'applabs',
  user: 'admin',
  password: 'An1od3lc0n3j0',
  ssl: false
});

async function limpiarYCambiarTipo() {
  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL');
    
    // Primero limpiar los datos existentes en hora_ejecucion
    console.log('🧹 Limpiando datos existentes en hora_ejecucion...');
    await client.query(`UPDATE consultas_placas SET hora_ejecucion = NULL`);
    console.log('✅ Datos limpiados');
    
    // Cambiar el tipo de columna a VARCHAR para almacenar solo HH:MM
    console.log('🔄 Cambiando tipo de hora_ejecucion a VARCHAR(5)...');
    await client.query(`
      ALTER TABLE consultas_placas 
      ALTER COLUMN hora_ejecucion TYPE VARCHAR(5);
    `);
    console.log('✅ Tipo de columna cambiado a VARCHAR(5)');
    
    // Verificar estructura final
    console.log('\n📋 Estructura actualizada:');
    const columns = await client.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'consultas_placas' AND column_name = 'hora_ejecucion'
      ORDER BY ordinal_position;
    `);
    console.table(columns.rows);
    
    await client.end();
    console.log('\n🎉 Campo hora_ejecucion actualizado exitosamente!');
    console.log('🕰️ Ahora guardará solo formato HH:MM (ejemplo: "09:30", "14:45")');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

limpiarYCambiarTipo();