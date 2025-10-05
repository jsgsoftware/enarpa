#!/bin/bash
set -e

# Script de inicialización para PostgreSQL
echo "🚀 Iniciando configuración de base de datos para ENA Consulta Placas..."

# Crear tabla vehiculos de ejemplo (si no existe)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Crear tabla vehiculos si no existe (para testing)
    CREATE TABLE IF NOT EXISTS public.vehiculos (
        id SERIAL PRIMARY KEY,
        auto_nombre VARCHAR(100),
        plate VARCHAR(20) UNIQUE NOT NULL,
        creado_en TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    );

    -- Insertar algunos vehículos de ejemplo
    INSERT INTO public.vehiculos (auto_nombre, plate) 
    VALUES 
        ('Auto #1', 'EI2430'),
        ('Auto #2', 'EI2431'),
        ('Auto #3', 'EI2432'),
        ('Auto #4', 'EI2433'),
        ('Auto #5', 'EI2438')
    ON CONFLICT (plate) DO NOTHING;

    -- Crear tabla consultas_placas
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
    );

    -- Crear índices para mejorar rendimiento
    CREATE INDEX IF NOT EXISTS idx_consultas_placas_placa ON public.consultas_placas(placa);
    CREATE INDEX IF NOT EXISTS idx_consultas_placas_vehiculo_id ON public.consultas_placas(vehiculo_id);
    CREATE INDEX IF NOT EXISTS idx_consultas_placas_fecha ON public.consultas_placas(fecha_consulta);
    CREATE INDEX IF NOT EXISTS idx_consultas_placas_exitosa ON public.consultas_placas(exitosa);

    -- Crear función para actualizar timestamp
    CREATE OR REPLACE FUNCTION update_actualizado_en_column()
    RETURNS TRIGGER AS \$\$
    BEGIN
        NEW.actualizado_en = NOW();
        RETURN NEW;
    END;
    \$\$ LANGUAGE plpgsql;

    -- Crear trigger para actualizar timestamp
    DROP TRIGGER IF EXISTS update_consultas_placas_actualizado_en ON public.consultas_placas;
    CREATE TRIGGER update_consultas_placas_actualizado_en
        BEFORE UPDATE ON public.consultas_placas
        FOR EACH ROW
        EXECUTE FUNCTION update_actualizado_en_column();

    -- Comentarios para documentar las tablas
    COMMENT ON TABLE public.vehiculos IS 'Tabla de vehículos registrados';
    COMMENT ON TABLE public.consultas_placas IS 'Registro de todas las consultas realizadas a placas vehiculares';
    COMMENT ON COLUMN public.consultas_placas.vehiculo_id IS 'ID del vehículo asociado (si existe en la tabla vehiculos)';
    COMMENT ON COLUMN public.consultas_placas.placa IS 'Número de placa consultada';
    COMMENT ON COLUMN public.consultas_placas.chk_defaulter IS 'Indicador si es moroso (del sistema externo)';
    COMMENT ON COLUMN public.consultas_placas.type_account IS 'Tipo de cuenta (del sistema externo)';
    COMMENT ON COLUMN public.consultas_placas.saldo IS 'Saldo disponible en la cuenta';
    COMMENT ON COLUMN public.consultas_placas.adeudado IS 'Monto adeudado';

    -- Mostrar resumen de lo creado
    SELECT 'Configuración de base de datos completada exitosamente' as mensaje;
    SELECT 'Tablas creadas:' as info;
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
    SELECT 'Vehículos de ejemplo insertados:' as info;
    SELECT count(*) as total_vehiculos FROM public.vehiculos;

EOSQL

echo "✅ Base de datos configurada exitosamente"