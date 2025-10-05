const { Client } = require('pg');

console.log('🔍 Verificando estado actual de la tabla...');

const client = new Client({
  host: '138.199.156.99',
  port: 5432,
  database: 'applabs',
  user: 'admin',
  password: 'An1od3lc0n3j0',
  ssl: false
});

async function verificarTabla() {
  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL');
    
    // Ver todas las consultas recientes
    console.log('\n📋 Últimas consultas (todas las columnas):');
    const consultas = await client.query(`
      SELECT 
        cp.*,
        v.plate
      FROM consultas_placas cp
      LEFT JOIN vehiculos v ON cp.vehiculo_id = v.id
      ORDER BY cp.id DESC
      LIMIT 10;
    `);
    
    console.table(consultas.rows);
    
    // Verificar si hay alguna consulta con hora_ejecucion
    console.log('\n🔍 Consultas con hora_ejecucion no nula:');
    const conHora = await client.query(`
      SELECT COUNT(*) as total
      FROM consultas_placas 
      WHERE hora_ejecucion IS NOT NULL;
    `);
    
    console.log('Total con hora_ejecucion:', conHora.rows[0].total);
    
    await client.end();
    console.log('\n✅ Verificación completada!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verificarTabla();