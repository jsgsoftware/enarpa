const { Client } = require('pg');

console.log('🔍 Verificando horas de ejecución únicas por lote...');

const client = new Client({
  host: '138.199.156.99',
  port: 5432,
  database: 'applabs',
  user: 'admin',
  password: 'An1od3lc0n3j0',
  ssl: false
});

async function verificarHorasEjecucion() {
  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL');
    
    // Ver las últimas consultas con hora de ejecución
    console.log('\n📋 Últimas consultas con hora de ejecución:');
    const consultas = await client.query(`
      SELECT 
        cp.id,
        v.plate,
        cp.saldo,
        cp.fecha_consulta,
        cp.hora_ejecucion
      FROM consultas_placas cp
      LEFT JOIN vehiculos v ON cp.vehiculo_id = v.id
      WHERE cp.hora_ejecucion IS NOT NULL
      ORDER BY cp.hora_ejecucion DESC, cp.id DESC
      LIMIT 20;
    `);
    
    console.table(consultas.rows);
    
    // Agrupar por hora de ejecución para ver los lotes
    console.log('\n📊 Agrupación por hora de ejecución (lotes):');
    const lotes = await client.query(`
      SELECT 
        hora_ejecucion,
        COUNT(*) as total_consultas,
        ARRAY_AGG(v.plate ORDER BY cp.id) as placas,
        MIN(cp.fecha_consulta) as primera_consulta,
        MAX(cp.fecha_consulta) as ultima_consulta
      FROM consultas_placas cp
      LEFT JOIN vehiculos v ON cp.vehiculo_id = v.id
      WHERE cp.hora_ejecucion IS NOT NULL
      GROUP BY hora_ejecucion
      ORDER BY hora_ejecucion DESC
      LIMIT 10;
    `);
    
    console.table(lotes.rows);
    
    await client.end();
    console.log('\n✅ Verificación completada!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verificarHorasEjecucion();