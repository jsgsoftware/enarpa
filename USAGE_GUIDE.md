# Sistema de Consulta de Placas - Optimizado para Evitar Timeouts

## 🚀 Nuevas Características

### Procesamiento Asíncrono para Consultas Masivas
- **Consultas Síncronas**: Para 1-5 placas, respuesta inmediata
- **Consultas Asíncronas**: Para 6+ placas, procesamiento en background
- **Monitoreo de Progreso**: Consulta el estado de procesamiento en tiempo real
- **Gestión de Lotes**: División automática en lotes para mejor rendimiento

## 📊 Endpoints Disponibles

### 1. Consulta Síncrona (Pocas Placas)
```
POST /api/consulta-placa-sync
```
- **Límite**: Máximo 5 placas
- **Respuesta**: Inmediata con resultados
- **Timeout**: 60 segundos

**Ejemplo de request:**
```json
{
  "placas": ["EI2430", "EI2431", "EI2432"]
}
```

**Ejemplo de response:**
```json
{
  "consultados": [
    {
      "plate": "EI2430",
      "chkDefaulter": false,
      "typeAccount": "PREPAGO",
      "saldo": 15.50,
      "adeudado": 0
    }
  ],
  "errores": []
}
```

### 2. Consulta Asíncrona (Muchas Placas)
```
POST /api/consulta-placa
```
- **Límite**: Sin límite (recomendado < 100 placas por request)
- **Respuesta**: ID de seguimiento inmediato
- **Procesamiento**: En background

**Ejemplo de request:**
```json
{
  "placas": ["EI2430", "EI2431", "EI2432", "EI2433", "EI2438", "EI2439"]
}
```

**Ejemplo de response:**
```json
{
  "message": "Procesando consulta masiva de placas",
  "requestId": "req_1728000000000_abc123def",
  "totalPlacas": 6,
  "estimatedTime": "1 minutos",
  "status": "processing"
}
```

### 3. Consultar Estado de Procesamiento
```
GET /api/consulta-status/{requestId}
```

**Ejemplo de response (en progreso):**
```json
{
  "requestId": "req_1728000000000_abc123def",
  "consultados": [...],
  "errores": [...],
  "procesados": 3,
  "total": 6,
  "iniciado": "2025-10-04T12:00:00.000Z",
  "finalizado": null,
  "status": "processing"
}
```

**Ejemplo de response (completado):**
```json
{
  "requestId": "req_1728000000000_abc123def",
  "consultados": [...],
  "errores": [...],
  "procesados": 6,
  "total": 6,
  "iniciado": "2025-10-04T12:00:00.000Z",
  "finalizado": "2025-10-04T12:03:00.000Z",
  "status": "completed"
}
```

## 🔧 Configuración para N8N

### Para Pocas Placas (Síncrono)
```json
{
  "method": "POST",
  "url": "https://tu-servidor.com/api/consulta-placa-sync",
  "headers": {
    "x-client-id": "tu_client_id",
    "x-client-secret": "tu_client_secret",
    "Content-Type": "application/json"
  },
  "body": {
    "placas": ["EI2430", "EI2431"]
  },
  "timeout": 60000
}
```

### Para Muchas Placas (Asíncrono)
**Paso 1: Iniciar procesamiento**
```json
{
  "method": "POST",
  "url": "https://tu-servidor.com/api/consulta-placa",
  "headers": {
    "x-client-id": "tu_client_id",
    "x-client-secret": "tu_client_secret",
    "Content-Type": "application/json"
  },
  "body": {
    "placas": ["EI2430", "EI2431", "EI2432", ...]
  },
  "timeout": 10000
}
```

**Paso 2: Monitorear progreso (en loop)**
```json
{
  "method": "GET",
  "url": "https://tu-servidor.com/api/consulta-status/{{$json.requestId}}",
  "headers": {
    "x-client-id": "tu_client_id",
    "x-client-secret": "tu_client_secret"
  }
}
```

## 🧪 Testing

### Ejecutar pruebas locales:
```bash
npm install axios
node test-batch.js
```

### Probar con Docker:
```bash
docker-compose up --build -d
node test-batch.js
```

## ⚡ Optimizaciones Implementadas

### Anti-Detección
- ✅ Rotación de User Agents
- ✅ Headers realistas
- ✅ Delays aleatorios entre consultas
- ✅ Reinicio periódico del navegador
- ✅ Gestión de lotes para evitar sobrecarga

### Rendimiento
- ✅ Procesamiento en lotes de 5 placas
- ✅ Reinicio de navegador cada 3 lotes
- ✅ Timeouts optimizados
- ✅ Cache temporal de resultados
- ✅ Limpieza automática de memoria

### Robustez
- ✅ Manejo de errores por lote
- ✅ Recuperación automática de fallos
- ✅ Monitoreo de progreso en tiempo real
- ✅ Logs detallados para debugging

## 🚨 Recomendaciones para Producción

1. **Para < 5 placas**: Usa `/consulta-placa-sync`
2. **Para 6-50 placas**: Usa `/consulta-placa` con monitoreo cada 10s
3. **Para 50+ placas**: Divide en múltiples requests de 50 placas

### Configuración de Timeouts en N8N:
- **Consulta sync**: 60 segundos
- **Consulta async (inicial)**: 10 segundos  
- **Monitoreo de estado**: 5 segundos
- **Entre consultas de estado**: 10 segundos

## 🔍 Monitoreo y Logs

El sistema genera logs detallados:
- `🚀` Inicio de procesamiento
- `📦` Procesamiento de lotes
- `🔍` Consulta individual
- `⏸️` Pausas entre lotes
- `🔄` Reinicio de navegador
- `✅` Procesamiento completado
- `❌` Errores
- `🗑️` Limpieza de cache

## 📈 Métricas de Rendimiento

- **Consulta individual**: 2-4 segundos
- **Lote de 5 placas**: 15-25 segundos
- **100 placas**: 8-12 minutos (aproximado)
- **Memoria**: < 500MB por navegador
- **CPU**: Moderado (spikes durante scraping)