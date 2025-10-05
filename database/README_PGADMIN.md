# Configuración de pgAdmin para ENA Consulta Placas

## 🌐 Acceso a pgAdmin

Después de ejecutar `docker-compose up -d`, puedes acceder a:

**URL:** http://localhost:8080
**Email:** admin@applabs.com  
**Password:** admin123

## 🔗 Configuración de Conexión a PostgreSQL

Una vez dentro de pgAdmin, crea una nueva conexión con estos datos:

### Pestaña General:
- **Name:** ENA Applabs DB
- **Server Group:** Servers

### Pestaña Connection:
- **Host name/address:** applabs_bd
- **Port:** 5432
- **Maintenance database:** applabs
- **Username:** admin
- **Password:** $An1od3iBuf4l0#

### Pestaña Advanced:
- **DB restriction:** applabs

## 📊 Tablas Disponibles

Después de conectarte, encontrarás:

### `public.vehiculos`
- Tabla de vehículos registrados
- Contiene placas de ejemplo para testing

### `public.consultas_placas`
- Registro de todas las consultas realizadas
- Se llena automáticamente al usar la API

## 🔍 Queries Útiles

```sql
-- Ver todos los vehículos
SELECT * FROM public.vehiculos;

-- Ver todas las consultas realizadas
SELECT * FROM public.consultas_placas ORDER BY fecha_consulta DESC;

-- Ver consultas por placa específica
SELECT * FROM public.consultas_placas WHERE placa = 'EI2430';

-- Estadísticas de consultas
SELECT 
    COUNT(*) as total_consultas,
    COUNT(CASE WHEN exitosa = true THEN 1 END) as exitosas,
    COUNT(CASE WHEN exitosa = false THEN 1 END) as fallidas,
    COUNT(DISTINCT placa) as placas_unicas
FROM public.consultas_placas;

-- Consultas con información de vehículo
SELECT 
    cp.*,
    v.auto_nombre
FROM public.consultas_placas cp
LEFT JOIN public.vehiculos v ON cp.vehiculo_id = v.id
ORDER BY cp.fecha_consulta DESC;
```

## 🚨 Troubleshooting

### Si no puedes conectarte a pgAdmin:
1. Verifica que Docker esté ejecutándose
2. Ejecuta: `docker ps` para ver los contenedores
3. Revisa logs: `docker logs applabs-pgadmin`

### Si no puedes conectarte a PostgreSQL desde pgAdmin:
1. Usa `applabs_bd` como host (no localhost)
2. Verifica que PostgreSQL esté ejecutándose: `docker logs applabs-postgresql`
3. Confirma que la red Docker esté funcionando

### Si las tablas no existen:
1. Revisa logs de PostgreSQL: `docker logs applabs-postgresql`
2. Ejecuta manualmente: `database/create_consultas_placas.sql`