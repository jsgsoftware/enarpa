const { Client } = require('pg');

console.log('🔧 Agregando campo hora_ejecucion a la tabla...');

const client = new Client({
  host: '138.199.156.99',
  port: 5432,
  database: 'applabs',
  user: 'admin',
  password: 'An1od3lc0n3j0',
  ssl: false
});

async function agregarCampoHoraEjecucion() {
  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL');
    
    // Agregar columna hora_ejecucion
    console.log('➕ Agregando columna hora_ejecucion...');
    await client.query(`
      ALTER TABLE consultas_placas 
      ADD COLUMN IF NOT EXISTS hora_ejecucion TIMESTAMP WITHOUT TIME ZONE;
    `);
    console.log('✅ Columna hora_ejecucion agregada');
    
    // Crear índice para mejorar consultas por hora de ejecución
    console.log('📊 Agregando índice para hora_ejecucion...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_consultas_hora_ejecucion 
      ON consultas_placas(hora_ejecucion);
    `);
    console.log('✅ Índice agregado');
    
    // Verificar estructura final
    console.log('\n📋 Estructura actualizada:');
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'consultas_placas' 
      ORDER BY ordinal_position;
    `);
    console.table(columns.rows);
    
    await client.end();
    console.log('\n🎉 Campo hora_ejecucion agregado exitosamente!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

agregarCampoHoraEjecucion();