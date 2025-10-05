-- Script para crear la tabla consultas_placas
-- Ejecutar en PostgreSQL para crear la estructura necesaria

-- Crear tabla consultas_placas si no existe
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

-- Crear trigger para actualizar timestamp
CREATE OR REPLACE FUNCTION update_actualizado_en_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_consultas_placas_actualizado_en ON public.consultas_placas;
CREATE TRIGGER update_consultas_placas_actualizado_en
    BEFORE UPDATE ON public.consultas_placas
    FOR EACH ROW
    EXECUTE FUNCTION update_actualizado_en_column();

-- Comentarios para documentar la tabla
COMMENT ON TABLE public.consultas_placas IS 'Registro de todas las consultas realizadas a placas vehiculares';
COMMENT ON COLUMN public.consultas_placas.vehiculo_id IS 'ID del vehículo asociado (si existe en la tabla vehiculos)';
COMMENT ON COLUMN public.consultas_placas.placa IS 'Número de placa consultada';
COMMENT ON COLUMN public.consultas_placas.chk_defaulter IS 'Indicador si es moroso (del sistema externo)';
COMMENT ON COLUMN public.consultas_placas.type_account IS 'Tipo de cuenta (del sistema externo)';
COMMENT ON COLUMN public.consultas_placas.saldo IS 'Saldo disponible en la cuenta';
COMMENT ON COLUMN public.consultas_placas.adeudado IS 'Monto adeudado';
COMMENT ON COLUMN public.consultas_placas.fecha_consulta IS 'Fecha y hora cuando se realizó la consulta';
COMMENT ON COLUMN public.consultas_placas.exitosa IS 'Indica si la consulta fue exitosa';
COMMENT ON COLUMN public.consultas_placas.mensaje_error IS 'Mensaje de error si la consulta falló';

-- Insertar datos de ejemplo (opcional, para testing)
-- INSERT INTO public.consultas_placas (placa, chk_defaulter, type_account, saldo, adeudado, exitosa)
-- VALUES ('TEST123', '0', '1', 15.50, 0.00, true);

-- Query de verificación
SELECT 'Tabla consultas_placas creada exitosamente' as mensaje;

-- Query para ver estructura
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'consultas_placas' 
  AND table_schema = 'public'
ORDER BY ordinal_position;