const { Client } = require('pg');

console.log('🔧 Corrigiendo tipo de campo hora_ejecucion...');

const client = new Client({
  host: '138.199.156.99',
  port: 5432,
  database: 'applabs',
  user: 'admin',
  password: 'An1od3lc0n3j0',
  ssl: false
});

async function corregirCampoHoraEjecucion() {
  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL');
    
    // Primero eliminar la columna incorrecta
    console.log('🗑️ Eliminando columna hora_ejecucion con tipo incorrecto...');
    await client.query(`
      ALTER TABLE consultas_placas 
      DROP COLUMN IF EXISTS hora_ejecucion;
    `);
    
    // Agregar la columna con el tipo correcto
    console.log('➕ Agregando columna hora_ejecucion como TIMESTAMP...');
    await client.query(`
      ALTER TABLE consultas_placas 
      ADD COLUMN hora_ejecucion TIMESTAMP WITHOUT TIME ZONE;
    `);
    console.log('✅ Columna hora_ejecucion agregada correctamente');
    
    // Crear índice
    console.log('📊 Agregando índice para hora_ejecucion...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_consultas_hora_ejecucion 
      ON consultas_placas(hora_ejecucion);
    `);
    console.log('✅ Índice agregado');
    
    // Verificar estructura final
    console.log('\n📋 Estructura corregida:');
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'consultas_placas' 
      ORDER BY ordinal_position;
    `);
    console.table(columns.rows);
    
    await client.end();
    console.log('\n🎉 Campo hora_ejecucion corregido exitosamente!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

corregirCampoHoraEjecucion();