const { query, getClient } = require('../config/database');
const { obtenerFechaPanama, obtenerHoraPanamaFormato } = require('../utils/timezone');

function normalizarMonto(valor) {
  if (valor === null || valor === undefined || valor === '') {
    return 0;
  }

  const numero = Number(valor);
  if (!Number.isFinite(numero)) {
    return 0;
  }

  return numero >= 100 ? numero / 100 : numero;
}

function extraerMontoDesdeTexto(texto) {
  if (!texto || typeof texto !== 'string') {
    return null;
  }

  const match = texto.match(/B\/\.?\s*([0-9]+(?:[.,][0-9]{1,2})?)/i);
  if (!match || !match[1]) {
    return null;
  }

  const numero = Number(match[1].replace(',', '.'));
  return Number.isFinite(numero) ? numero : null;
}

function obtenerSaldoResultado(resultado) {
  if (resultado && resultado.balanceAmount !== null && resultado.balanceAmount !== undefined && resultado.balanceAmount !== '') {
    return normalizarMonto(resultado.balanceAmount);
  }

  const montoDesdeMensaje = extraerMontoDesdeTexto(resultado && resultado.message);
  return montoDesdeMensaje !== null ? montoDesdeMensaje : 0;
}

function obtenerAdeudadoResultado(resultado) {
  if (resultado && resultado.totalAmount !== null && resultado.totalAmount !== undefined && resultado.totalAmount !== '') {
    return normalizarMonto(resultado.totalAmount);
  }

  return 0;
}

/**
 * Servicio para manejar la persistencia de consultas de placas en PostgreSQL
 */
class ConsultaPlacaService {
  
  /**
   * Buscar el ID del vehículo por placa
   * @param {string} placa - Número de placa del vehículo
   * @returns {Object|null} - Datos del vehículo o null si no se encuentra
   */
  async buscarVehiculoPorPlaca(placa) {
    try {
      const result = await query(
        'SELECT id, auto_nombre, plate, creado_en FROM public.vehiculos WHERE plate = $1',
        [placa]
      );
      
      if (result.rows.length > 0) {
        console.log(`🚗 Vehículo encontrado para placa ${placa}:`, result.rows[0]);
        return result.rows[0];
      } else {
        console.log(`⚠️ No se encontró vehículo para placa: ${placa}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Error buscando vehículo para placa ${placa}:`, error.message);
      throw error;
    }
  }

  /**
   * Guardar resultado de consulta de placa
   * @param {string} placa - Número de placa consultada
   * @param {Object} resultadoConsulta - Resultado de la consulta
   * @param {number|null} vehiculoId - ID del vehículo (si se encontró)
   * @param {Date|null} fechaLote - Fecha del lote (si no se proporciona, usa fecha actual)
   * @param {Date|null} horaEjecucion - Hora exacta de ejecución del batch (única por lote)
   * @returns {Object} - Registro guardado
   */
  async guardarConsultaPlaca(placa, resultadoConsulta, vehiculoId = null, fechaLote = null, horaEjecucion = null) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      // Preparar datos para insertar (usar fecha del lote o actual)
      const datosConsulta = {
        vehiculo_id: vehiculoId,
        chk_defaulter: resultadoConsulta.chkDefaulter,
        type_account: resultadoConsulta.typeAccount,
        saldo: resultadoConsulta.saldo || 0,
        adeudado: resultadoConsulta.adeudado || 0,
        fecha_consulta: fechaLote || obtenerFechaPanama(), // Usar fecha del lote o fecha de Panamá
        hora_ejecucion: horaEjecucion || obtenerHoraPanamaFormato() // Hora exacta de ejecución del batch (formato HH:MM en zona Panamá)
      };

      // Insertar en tabla consultas_placas (incluyendo hora_ejecucion)
      const insertQuery = `
        INSERT INTO public.consultas_placas 
        (vehiculo_id, chk_defaulter, type_account, saldo, adeudado, fecha_consulta, hora_ejecucion)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      
      const values = [
        datosConsulta.vehiculo_id,
        datosConsulta.chk_defaulter,
        datosConsulta.type_account,
        datosConsulta.saldo,
        datosConsulta.adeudado,
        datosConsulta.fecha_consulta,
        datosConsulta.hora_ejecucion
      ];

      const result = await client.query(insertQuery, values);
      
      await client.query('COMMIT');
      
      const registroGuardado = result.rows[0];
      console.log(`💾 Consulta guardada para placa ${placa}:`, {
        id: registroGuardado.id,
        vehiculo_id: registroGuardado.vehiculo_id,
        saldo: registroGuardado.saldo,
        fecha_consulta: registroGuardado.fecha_consulta,
        hora_ejecucion: registroGuardado.hora_ejecucion
      });
      
      return registroGuardado;
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Error guardando consulta para placa ${placa}:`, error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Procesar y guardar resultado completo de consulta
   * @param {string} placa - Número de placa
   * @param {Object} resultado - Resultado completo de la consulta
   * @param {Date|null} fechaLote - Fecha del lote para todas las consultas del mismo batch
   * @param {Date|null} horaEjecucion - Hora exacta de ejecución del batch (única por lote)
   * @returns {Object} - Información del procesamiento
   */
  async procesarYGuardarConsulta(placa, resultado, fechaLote = null, horaEjecucion = null) {
    try {
      console.log(`💽 Procesando para guardar consulta de placa: ${placa}`);
      
      // 1. Buscar vehículo por placa
      const vehiculo = await this.buscarVehiculoPorPlaca(placa);
      
      // 2. Preparar datos de resultado
      const datosParaGuardar = {
        success: resultado.success,
        chkDefaulter: resultado.chkDefaulter,
        typeAccount: resultado.typeAccount,
        saldo: obtenerSaldoResultado(resultado),
        adeudado: obtenerAdeudadoResultado(resultado),
        error: resultado.success ? null : resultado.message
      };
      
      // 3. Guardar en base de datos
      const registroGuardado = await this.guardarConsultaPlaca(
        placa, 
        datosParaGuardar, 
        vehiculo ? vehiculo.id : null,
        fechaLote, // Pasar la fecha del lote
        horaEjecucion // Pasar la hora de ejecución única del batch
      );
      
      return {
        exito: true,
        vehiculo_encontrado: !!vehiculo,
        vehiculo_id: vehiculo?.id || null,
        registro_id: registroGuardado.id,
        placa: placa,
        mensaje: `Consulta guardada exitosamente para placa ${placa}`
      };
      
    } catch (error) {
      console.error(`❌ Error procesando consulta de placa ${placa}:`, error.message);
      
      return {
        exito: false,
        vehiculo_encontrado: false,
        vehiculo_id: null,
        registro_id: null,
        placa: placa,
        error: error.message,
        mensaje: `Error guardando consulta para placa ${placa}`
      };
    }
  }

  /**
   * Obtener historial de consultas de una placa
   * @param {string} placa - Número de placa
   * @param {number} limite - Número máximo de registros
   * @returns {Array} - Historial de consultas
   */
  async obtenerHistorialConsultas(placa, limite = 10) {
    try {
      // Buscar por vehiculo_id primero
      const vehiculo = await this.buscarVehiculoPorPlaca(placa);
      
      if (!vehiculo) {
        console.log(`⚠️ No se encontró vehículo para placa ${placa}`);
        return [];
      }
      
      const result = await query(`
        SELECT 
          cp.*,
          v.auto_nombre,
          v.plate as placa,
          v.creado_en as vehiculo_creado
        FROM public.consultas_placas cp
        LEFT JOIN public.vehiculos v ON cp.vehiculo_id = v.id
        WHERE cp.vehiculo_id = $1
        ORDER BY cp.fecha_consulta DESC
        LIMIT $2
      `, [vehiculo.id, limite]);
      
      console.log(`📋 Historial obtenido para placa ${placa}: ${result.rows.length} registros`);
      return result.rows;
      
    } catch (error) {
      console.error(`❌ Error obteniendo historial para placa ${placa}:`, error.message);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de consultas
   * @returns {Object} - Estadísticas generales
   */
  async obtenerEstadisticas() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_consultas,
          COUNT(CASE WHEN saldo > 0 THEN 1 END) as consultas_con_saldo,
          COUNT(CASE WHEN saldo = 0 THEN 1 END) as consultas_sin_saldo,
          COUNT(DISTINCT vehiculo_id) as vehiculos_consultados,
          COUNT(CASE WHEN vehiculo_id IS NOT NULL THEN 1 END) as con_vehiculo_asociado,
          MAX(fecha_consulta) as ultima_consulta,
          AVG(saldo) as saldo_promedio
        FROM public.consultas_placas
      `);
      
      const stats = result.rows[0];
      console.log('📊 Estadísticas de consultas:', stats);
      return stats;
      
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error.message);
      throw error;
    }
  }

  /**
   * Obtener consultas por hora de ejecución del lote
   * @param {Date} horaEjecucion - Hora de ejecución del lote a buscar
   * @returns {Array} - Lista de consultas del lote
   */
  async obtenerConsultasPorLote(horaEjecucion) {
    try {
      const result = await query(`
        SELECT 
          cp.*,
          v.plate,
          v.auto_nombre
        FROM public.consultas_placas cp
        LEFT JOIN public.vehiculos v ON cp.vehiculo_id = v.id
        WHERE cp.hora_ejecucion = $1
        ORDER BY cp.id ASC
      `, [horaEjecucion]);
      
      console.log(`📊 Encontradas ${result.rows.length} consultas para la hora de ejecución ${horaEjecucion.toISOString()}`);
      return result.rows;
      
    } catch (error) {
      console.error('❌ Error obteniendo consultas por lote:', error.message);
      throw error;
    }
  }

  /**
   * Obtener estadísticas por lotes basadas en hora de ejecución
   * @param {number} limiteLotes - Número máximo de lotes a mostrar
   * @returns {Array} - Estadísticas agrupadas por lote
   */
  async obtenerEstadisticasPorLote(limiteLotes = 10) {
    try {
      const result = await query(`
        SELECT 
          hora_ejecucion as lote_hora_ejecucion,
          COUNT(*) as total_consultas,
          COUNT(CASE WHEN saldo > 0 THEN 1 END) as consultas_con_saldo,
          AVG(saldo) as saldo_promedio,
          SUM(saldo) as saldo_total,
          MIN(fecha_consulta) as primera_consulta,
          MAX(fecha_consulta) as ultima_consulta
        FROM public.consultas_placas
        WHERE hora_ejecucion IS NOT NULL
        GROUP BY hora_ejecucion
        ORDER BY hora_ejecucion DESC
        LIMIT $1
      `, [limiteLotes]);
      
      return result.rows.map(row => ({
        lote_hora_ejecucion: row.lote_hora_ejecucion,
        total_consultas: parseInt(row.total_consultas),
        consultas_con_saldo: parseInt(row.consultas_con_saldo),
        saldo_promedio: parseFloat(row.saldo_promedio || 0).toFixed(2),
        saldo_total: parseFloat(row.saldo_total || 0).toFixed(2),
        primera_consulta: row.primera_consulta,
        ultima_consulta: row.ultima_consulta,
        duracion_lote: new Date(row.ultima_consulta) - new Date(row.primera_consulta)
      }));
      
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas por lote:', error.message);
      throw error;
    }
  }
}

module.exports = new ConsultaPlacaService();
