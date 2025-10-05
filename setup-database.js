const { Pool } = require('pg');

// Configuración para conectar a la base de datos externa
const dbConfig = {
  user: 'admin',
  password: '$An1od3iBuf4l0#',
  host: '138.199.156.99',
  port: 5432,
  database: 'applabs',
  ssl: false, // Cambiar a true si requiere SSL
  connectionTimeoutMillis: 10000,
};

const pool = new Pool(dbConfig);

async function crearTablas() {
  const client = await pool.connect();
  
  try {
    console.log('🔗 Conectando a la base de datos...');
    
    // Verificar conexión
    const testResult = await client.query('SELECT NOW()');
    console.log('✅ Conexión exitosa:', testResult.rows[0]);
    
    console.log('📋 Creando tabla vehiculos...');
    
    // Crear tabla vehiculos si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.vehiculos (
        id SERIAL PRIMARY KEY,
        auto_nombre VARCHAR(100),
        plate VARCHAR(20) UNIQUE NOT NULL,
        creado_en TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      )
    `);
    
    console.log('✅ Tabla vehiculos creada o ya existe');
    
    // Insertar algunos vehículos de ejemplo
    console.log('📝 Insertando vehículos de ejemplo...');
    await client.query(`
      INSERT INTO public.vehiculos (auto_nombre, plate) 
      VALUES 
        ('Auto #1', 'EI2430'),
        ('Auto #2', 'EI2431'),
        ('Auto #3', 'EI2432'),
        ('Auto #4', 'EI2433'),
        ('Auto #5', 'EI2438'),
        ('Auto #6', 'EI2439'),
        ('Auto #7', 'EK5464'),
        ('Auto #8', 'EK5465')
      ON CONFLICT (plate) DO NOTHING
    `);
    
    console.log('📋 Creando tabla consultas_placas...');
    
    // Crear tabla consultas_placas
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.consultas_placas (
        id SERIAL PRIMARY KEY,
        vehiculo_id INTEGER REFERENCES public.vehiculos(id) ON DELETE SET NULL,
        placa VARCHAR(20) NOT NULL,
        chk_defaulter VARCHAR(10),
        type_account VARCHAR(10),
        saldo NUMERIC(10,2) DEFAULT 0.00,
        adeudado NUMERIC(10,2) DEFAULT 0.00,
        fecha_consulta TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
        exitosa BOOLEAN DEFAULT FALSE,
        mensaje_error TEXT,
        creado_en TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
        actualizado_en TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      )
    `);
    
    console.log('✅ Tabla consultas_placas creada o ya existe');
    
    console.log('🔍 Creando índices...');
    
    // Crear índices
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_consultas_placas_placa ON public.consultas_placas(placa)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_consultas_placas_vehiculo_id ON public.consultas_placas(vehiculo_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_consultas_placas_fecha ON public.consultas_placas(fecha_consulta)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_consultas_placas_exitosa ON public.consultas_placas(exitosa)
    `);
    
    console.log('✅ Índices creados');
    
    console.log('⚙️ Creando función y trigger para timestamp...');
    
    // Crear función para actualizar timestamp
    await client.query(`
      CREATE OR REPLACE FUNCTION update_actualizado_en_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.actualizado_en = NOW();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    
    // Crear trigger
    await client.query(`
      DROP TRIGGER IF EXISTS update_consultas_placas_actualizado_en ON public.consultas_placas
    `);
    await client.query(`
      CREATE TRIGGER update_consultas_placas_actualizado_en
          BEFORE UPDATE ON public.consultas_placas
          FOR EACH ROW
          EXECUTE FUNCTION update_actualizado_en_column()
    `);
    
    console.log('✅ Función y trigger creados');
    
    // Verificar que todo se creó correctamente
    console.log('📊 Verificando tablas creadas...');
    const tablesResult = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📋 Tablas en la base de datos:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Contar vehículos
    const vehiculosResult = await client.query('SELECT COUNT(*) as total FROM public.vehiculos');
    console.log(`🚗 Total de vehículos: ${vehiculosResult.rows[0].total}`);
    
    // Mostrar algunos vehículos
    const vehiculosEjemplo = await client.query('SELECT * FROM public.vehiculos LIMIT 5');
    console.log('🚗 Vehículos de ejemplo:');
    vehiculosEjemplo.rows.forEach(vehiculo => {
      console.log(`  - ID: ${vehiculo.id}, Placa: ${vehiculo.plate}, Nombre: ${vehiculo.auto_nombre}`);
    });
    
    console.log('\n🎉 ¡Base de datos configurada exitosamente!');
    console.log('✅ Tablas creadas: vehiculos, consultas_placas');
    console.log('✅ Índices optimizados creados');
    console.log('✅ Triggers para timestamps configurados');
    console.log('✅ Datos de ejemplo insertados');
    
  } catch (error) {
    console.error('❌ Error configurando base de datos:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await crearTablas();
    console.log('\n🚀 La base de datos está lista para usar con la API!');
  } catch (error) {
    console.error('❌ Error en configuración:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { crearTablas };