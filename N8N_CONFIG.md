# Configuración N8N - Sistema Anti-Timeout

## 🎯 Solución para tu Problema

El error que estás viendo en N8N se debe a que intentas procesar 40 placas de forma síncrona, lo que toma más de 5 minutos y causa timeout.

### ❌ Configuración Anterior (Causa Timeout)
```json
{
  "method": "POST",
  "uri": "https://applabs-ena.oqsrcv.easypanel.host/api/consulta-placa",
  "body": {
    "placas": ["EI2430", "EI2431", ..., "EM3082"]  // 40 placas
  },
  "timeout": 300000  // 5 minutos - NO es suficiente
}
```

### ✅ Nueva Configuración (Evita Timeout)

#### Opción 1: Procesar en Lotes Pequeños
Divide las 40 placas en grupos de 5 y procesa cada grupo:

**Node 1: Dividir Array**
```javascript
// En un Function Node
const placas = [
  "EI2430", "EI2431", "EI2432", "EI2433", "EI2438", "EI2439",
  "EK5464", "EK5465", "EK5466", "EK5467", "EK5468", "EK5469",
  "EL3928", "EL3929", "EL3930", "EL3931", "EL3932", "EL3933", 
  "EL3934", "EL3957", "EL3958", "EL3959", "EM3064", "EM3065",
  "EM3066", "EM3067", "EM3068", "EM3069", "EM3070", "EM3071",
  "EM3072", "EM3073", "EM3074", "EM3075", "EM3076", "EM3078",
  "EM3079", "EM3080", "EM3081", "EM3082"
];

const lotes = [];
for (let i = 0; i < placas.length; i += 5) {
  lotes.push({
    lote: Math.floor(i/5) + 1,
    placas: placas.slice(i, i + 5)
  });
}

return lotes.map(lote => ({ json: lote }));
```

**Node 2: HTTP Request (con Split In Batches)**
```json
{
  "method": "POST",
  "url": "https://applabs-ena.oqsrcv.easypanel.host/api/consulta-placa-sync",
  "headers": {
    "x-client-id": "mi_cliente_super_seguro",
    "x-client-secret": "mi_secreto_super_seguro",
    "Content-Type": "application/json"
  },
  "body": {
    "placas": "={{ $json.placas }}"
  },
  "timeout": 60000
}
```

**Node 3: Wait (entre lotes)**
```json
{
  "amount": 5,
  "unit": "seconds"
}
```

#### Opción 2: Procesamiento Asíncrono Completo
Para procesar todas las 40 placas de una vez:

**Paso 1: Iniciar Procesamiento**
```json
{
  "method": "POST",
  "url": "https://applabs-ena.oqsrcv.easypanel.host/api/consulta-placa",
  "headers": {
    "x-client-id": "mi_cliente_super_seguro",
    "x-client-secret": "mi_secreto_super_seguro",
    "Content-Type": "application/json"
  },
  "body": {
    "placas": [
      "EI2430", "EI2431", "EI2432", "EI2433", "EI2438", "EI2439",
      "EK5464", "EK5465", "EK5466", "EK5467", "EK5468", "EK5469",
      "EL3928", "EL3929", "EL3930", "EL3931", "EL3932", "EL3933",
      "EL3934", "EL3957", "EL3958", "EL3959", "EM3064", "EM3065",
      "EM3066", "EM3067", "EM3068", "EM3069", "EM3070", "EM3071",
      "EM3072", "EM3073", "EM3074", "EM3075", "EM3076", "EM3078",
      "EM3079", "EM3080", "EM3081", "EM3082"
    ]
  },
  "timeout": 10000
}
```

**Paso 2: Monitorear Progreso (Loop)**
```json
{
  "method": "GET",
  "url": "https://applabs-ena.oqsrcv.easypanel.host/api/consulta-status/{{ $json.requestId }}",
  "headers": {
    "x-client-id": "mi_cliente_super_seguro",
    "x-client-secret": "mi_secreto_super_seguro"
  },
  "timeout": 5000
}
```

**Paso 3: Condition Node**
```javascript
// Condición para continuar el loop
return {{ $json.status !== 'completed' && $json.status !== 'error' }};
```

**Paso 4: Wait Node (en el loop)**
```json
{
  "amount": 10,
  "unit": "seconds"
}
```

## 🚀 Workflow Recomendado para N8N

```
[Trigger] 
    ↓
[Function: Crear Lotes]
    ↓
[Split In Batches: 1]
    ↓
[HTTP: consulta-placa-sync]
    ↓
[Wait: 5 segundos]
    ↓
[Function: Compilar Resultados]
```

### Ejemplo de Function Node para Compilar Resultados:
```javascript
// Función para compilar todos los resultados
const todosLosResultados = {
  consultados: [],
  errores: [],
  resumen: {
    totalProcesadas: 0,
    exitosas: 0,
    conErrores: 0
  }
};

// Iterar sobre todos los resultados de los lotes
for (const lote of $input.all()) {
  if (lote.json.consultados) {
    todosLosResultados.consultados.push(...lote.json.consultados);
  }
  if (lote.json.errores) {
    todosLosResultados.errores.push(...lote.json.errores);
  }
}

// Calcular resumen
todosLosResultados.resumen.totalProcesadas = 
  todosLosResultados.consultados.length + todosLosResultados.errores.length;
todosLosResultados.resumen.exitosas = todosLosResultados.consultados.length;
todosLosResultados.resumen.conErrores = todosLosResultados.errores.length;

return { json: todosLosResultados };
```

## 📊 Configuraciones Recomendadas

### Para 40 placas en lotes de 5:
- **Tiempo total estimado**: 8-10 minutos
- **Timeout por lote**: 60 segundos
- **Pausa entre lotes**: 5 segundos
- **Memoria**: Baja
- **Confiabilidad**: Alta

### Para procesamiento asíncrono completo:
- **Tiempo total estimado**: 8-12 minutos
- **Timeout inicial**: 10 segundos
- **Timeout de monitoreo**: 5 segundos
- **Intervalo de check**: 10 segundos
- **Memoria**: Media
- **Confiabilidad**: Muy Alta

## 🔧 Troubleshooting

### Si sigues teniendo timeouts:
1. **Reduce el tamaño de lote** a 3 placas
2. **Aumenta la pausa** entre lotes a 10 segundos
3. **Verifica que el servidor esté respondiendo** en `/health`
4. **Revisa los logs** del servidor para errores específicos

### Comandos útiles:
```bash
# Verificar estado del servidor
curl https://applabs-ena.oqsrcv.easypanel.host/health

# Ver estadísticas del servidor
curl https://applabs-ena.oqsrcv.easypanel.host/stats
```