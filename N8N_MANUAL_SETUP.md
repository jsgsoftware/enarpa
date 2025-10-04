# Configuración Manual para N8N

## 🎯 Workflow Anti-Timeout para 40 Placas

### Node 1: Manual Trigger
- **Tipo**: Manual Trigger
- **Configuración**: Default

### Node 2: Function - Crear Lotes de Placas
```javascript
// Configurar las 40 placas a procesar
const placas = [
  "EI2430", "EI2431", "EI2432", "EI2433", "EI2438", "EI2439",
  "EK5464", "EK5465", "EK5466", "EK5467", "EK5468", "EK5469",
  "EL3928", "EL3929", "EL3930", "EL3931", "EL3932", "EL3933",
  "EL3934", "EL3957", "EL3958", "EL3959", "EM3064", "EM3065",
  "EM3066", "EM3067", "EM3068", "EM3069", "EM3070", "EM3071",
  "EM3072", "EM3073", "EM3074", "EM3075", "EM3076", "EM3078",
  "EM3079", "EM3080", "EM3081", "EM3082"
];

// Dividir en lotes de 5 placas para evitar timeouts
const tamañoLote = 5;
const lotes = [];

for (let i = 0; i < placas.length; i += tamañoLote) {
  lotes.push({
    loteNumero: Math.floor(i / tamañoLote) + 1,
    totalLotes: Math.ceil(placas.length / tamañoLote),
    placas: placas.slice(i, i + tamañoLote),
    inicio: i + 1,
    fin: Math.min(i + tamañoLote, placas.length)
  });
}

console.log(`📦 Creados ${lotes.length} lotes de máximo ${tamañoLote} placas`);

return lotes.map(lote => ({ json: lote }));
```

### Node 3: Split In Batches
- **Tipo**: Split In Batches
- **Configuración**:
  - Batch Size: 1
  - Reset: false

### Node 4: HTTP Request - Consultar Lote de Placas
- **Tipo**: HTTP Request
- **Configuración**:
  - Method: POST
  - URL: `https://applabs-ena.oqsrcv.easypanel.host/api/consulta-placa-sync`
  - Authentication: None
  - Send Headers: true
  - Headers:
    ```json
    {
      "x-client-id": "mi_cliente_super_seguro",
      "x-client-secret": "mi_secreto_super_seguro",
      "Content-Type": "application/json"
    }
    ```
  - Send Body: true
  - Body Content Type: JSON
  - JSON Parameters: true
  - Body:
    ```json
    {
      "placas": "={{ $json.placas }}"
    }
    ```
  - Timeout: 60000 (60 segundos)

### Node 5: Function - Procesar Respuesta del Lote
```javascript
// Procesar respuesta del lote
const loteInfo = $('Split In Batches').item.json;
const respuesta = $json;

// Agregar información del lote a cada resultado
const resultado = {
  lote: loteInfo.loteNumero,
  totalLotes: loteInfo.totalLotes,
  placasEnLote: loteInfo.placas,
  consultados: respuesta.consultados || [],
  errores: respuesta.errores || [],
  timestamp: new Date().toISOString()
};

// Log de progreso
console.log(`✅ Lote ${loteInfo.loteNumero}/${loteInfo.totalLotes} completado:`);
console.log(`   📊 Exitosas: ${resultado.consultados.length}`);
console.log(`   ❌ Errores: ${resultado.errores.length}`);

return { json: resultado };
```

### Node 6: Wait - Pausa Entre Lotes
- **Tipo**: Wait
- **Configuración**:
  - Amount: 3
  - Unit: seconds

### Node 7: Function - Compilar Resultados Finales
```javascript
// Compilar todos los resultados de todos los lotes
const todosLosLotes = $input.all();

const resultadoFinal = {
  resumen: {
    timestamp: new Date().toISOString(),
    totalLotes: 0,
    totalPlacasProcesadas: 0,
    totalExitosas: 0,
    totalErrores: 0,
    porcentajeExito: 0
  },
  consultados: [],
  errores: [],
  detallesPorLote: []
};

// Procesar cada lote
for (const lote of todosLosLotes) {
  const data = lote.json;
  
  // Agregar consultados
  if (data.consultados && Array.isArray(data.consultados)) {
    resultadoFinal.consultados.push(...data.consultados);
  }
  
  // Agregar errores
  if (data.errores && Array.isArray(data.errores)) {
    resultadoFinal.errores.push(...data.errores);
  }
  
  // Guardar detalles del lote
  resultadoFinal.detallesPorLote.push({
    lote: data.lote,
    placas: data.placasEnLote,
    exitosas: data.consultados?.length || 0,
    errores: data.errores?.length || 0,
    timestamp: data.timestamp
  });
}

// Calcular resumen
resultadoFinal.resumen.totalLotes = resultadoFinal.detallesPorLote.length;
resultadoFinal.resumen.totalExitosas = resultadoFinal.consultados.length;
resultadoFinal.resumen.totalErrores = resultadoFinal.errores.length;
resultadoFinal.resumen.totalPlacasProcesadas = 
  resultadoFinal.resumen.totalExitosas + resultadoFinal.resumen.totalErrores;
resultadoFinal.resumen.porcentajeExito = 
  resultadoFinal.resumen.totalPlacasProcesadas > 0 
    ? Math.round((resultadoFinal.resumen.totalExitosas / resultadoFinal.resumen.totalPlacasProcesadas) * 100)
    : 0;

// Log final
console.log('🎉 PROCESAMIENTO COMPLETADO:');
console.log(`📊 Total procesadas: ${resultadoFinal.resumen.totalPlacasProcesadas}`);
console.log(`✅ Exitosas: ${resultadoFinal.resumen.totalExitosas}`);
console.log(`❌ Errores: ${resultadoFinal.resumen.totalErrores}`);
console.log(`📈 Porcentaje de éxito: ${resultadoFinal.resumen.porcentajeExito}%`);

return { json: resultadoFinal };
```

## 🔗 Conexiones
1. Manual Trigger → Crear Lotes de Placas
2. Crear Lotes de Placas → Split In Batches
3. Split In Batches → HTTP Request
4. HTTP Request → Procesar Respuesta del Lote
5. Procesar Respuesta del Lote → Wait
6. Wait → Compilar Resultados Finales

## ⚙️ Configuración Adicional

### Configuración del HTTP Request Node
- **Error on Fail**: false (para manejar errores gracefully)
- **Ignore SSL Issues**: false (mantener seguridad)
- **Follow Redirects**: true
- **Return Full Response**: false

### Variables de Entorno Recomendadas
```bash
# En tu configuración de N8N
WEBHOOK_URL=https://applabs-ena.oqsrcv.easypanel.host
CLIENT_ID=mi_cliente_super_seguro
CLIENT_SECRET=mi_secreto_super_seguro
```

## 📊 Resultado Esperado

Después de ejecutar el workflow, obtendrás:

```json
{
  "resumen": {
    "timestamp": "2025-10-04T12:34:56.789Z",
    "totalLotes": 8,
    "totalPlacasProcesadas": 40,
    "totalExitosas": 38,
    "totalErrores": 2,
    "porcentajeExito": 95
  },
  "consultados": [
    {
      "plate": "EI2430",
      "chkDefaulter": false,
      "typeAccount": "PREPAGO",
      "saldo": 15.50,
      "adeudado": 0
    }
    // ... más resultados
  ],
  "errores": [
    {
      "plate": "EI2431",
      "error": "Placa no encontrada"
    }
    // ... errores si los hay
  ],
  "detallesPorLote": [
    {
      "lote": 1,
      "placas": ["EI2430", "EI2431", "EI2432", "EI2433", "EI2438"],
      "exitosas": 4,
      "errores": 1,
      "timestamp": "2025-10-04T12:30:00.000Z"
    }
    // ... detalles por lote
  ]
}
```

## 🕐 Tiempo Estimado
- **40 placas en 8 lotes**: ~8-10 minutos
- **Tiempo por lote**: ~60 segundos
- **Pausa entre lotes**: 3 segundos

## 🚨 Ventajas de Esta Configuración
- ✅ **Sin timeouts**: Cada lote se procesa en < 60 segundos
- ✅ **Progreso visible**: Logs en cada paso
- ✅ **Resistente a errores**: Un lote con error no afecta los demás
- ✅ **Resultado consolidado**: Todos los datos al final
- ✅ **Pausas inteligentes**: Evita ser bloqueado por rate limiting