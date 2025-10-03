# API Consulta Panapass - Docker

Esta es una API dockerizada para consultar saldos de tarjetas Panapass de Panamá.

## 🚀 Inicio Rápido con Docker

### Prerrequisitos
- Docker instalado en tu sistema
- Docker Compose (incluido con Docker Desktop)

### 1. Configuración Inicial

Copia el archivo de ejemplo de variables de entorno:
```bash
cp .env.example .env
```

Edita el archivo `.env` con tus credenciales:
```bash
# Editar con tus valores reales
CLIENT_ID=tu_client_id_real
CLIENT_SECRET=tu_client_secret_real
PORT=3000
NODE_ENV=production
```

### 2. Construir y Ejecutar

#### Opción A: Con Docker Compose (Recomendado)
```bash
# Construir y ejecutar en segundo plano
docker-compose up -d --build

# Ver logs
docker-compose logs -f

# Detener
docker-compose down
```

#### Opción B: Con Docker directamente
```bash
# Construir la imagen
docker build -t ena-panapass-api .

# Ejecutar el contenedor
docker run -d \
  --name ena-api \
  -p 3000:3000 \
  --env-file .env \
  ena-panapass-api

# Ver logs
docker logs -f ena-api

# Detener
docker stop ena-api
docker rm ena-api
```

### 3. Verificar que está funcionando

La API estará disponible en: `http://localhost:3000`

## 📡 Uso de la API

### Endpoint Principal
```
POST /api/consulta
```

### Headers Requeridos
```
Content-Type: application/json
x-client-id: tu_client_id
x-client-secret: tu_client_secret
```

### Ejemplo de Request
```bash
curl -X POST http://localhost:3000/api/consulta \
  -H "Content-Type: application/json" \
  -H "x-client-id: tu_client_id" \
  -H "x-client-secret: tu_client_secret" \
  -d '{
    "panapass": ["1234567890", "0987654321"]
  }'
```

### Ejemplo de Response
```json
{
  "consultados": [
    {
      "panapass": "1234567890",
      "saldo": 25.50
    }
  ],
  "errores": [
    {
      "panapass": "0987654321",
      "error": "Tarjeta no encontrada"
    }
  ]
}
```

## 🛠️ Comandos Útiles de Docker

```bash
# Ver contenedores ejecutándose
docker ps

# Ver logs en tiempo real
docker-compose logs -f ena-api

# Entrar al contenedor (para debugging)
docker exec -it ena-panapass-api sh

# Reconstruir sin caché
docker-compose build --no-cache

# Ver uso de recursos
docker stats ena-panapass-api

# Limpiar imágenes no utilizadas
docker image prune
```

## 🔧 Configuración Avanzada

### Variables de Entorno Disponibles
- `PORT`: Puerto del servidor (default: 3000)
- `CLIENT_ID`: ID del cliente para autenticación
- `CLIENT_SECRET`: Secret del cliente para autenticación
- `NODE_ENV`: Entorno de ejecución (production/development)

### Personalizar Docker Compose
Puedes modificar `docker-compose.yml` para:
- Cambiar el puerto expuesto
- Agregar volúmenes persistentes
- Configurar redes personalizadas
- Agregar servicios adicionales (base de datos, redis, etc.)

### Health Check
El contenedor incluye un health check que verifica cada 30 segundos si la aplicación responde correctamente.

## 🐛 Troubleshooting

### Problemas Comunes

1. **Error de permisos con Puppeteer**
   ```bash
   # Verificar que el contenedor tiene los permisos necesarios
   docker logs ena-panapass-api
   ```

2. **Puerto ya en uso**
   ```bash
   # Cambiar el puerto en docker-compose.yml o .env
   ports:
     - "3001:3000"  # Cambiar primer número
   ```

3. **Variables de entorno no cargadas**
   ```bash
   # Verificar que el archivo .env existe y tiene los valores correctos
   cat .env
   ```

## 📦 Estructura del Proyecto

```
.
├── Dockerfile              # Configuración de la imagen Docker
├── docker-compose.yml      # Configuración de servicios
├── .dockerignore           # Archivos excluidos del contexto Docker
├── .env.example            # Ejemplo de variables de entorno
├── package.json            # Dependencias de Node.js
├── server.js               # Aplicación principal
└── README.md              # Esta documentación
```

## ⚠️ Notas de Seguridad

- Nunca subas el archivo `.env` con credenciales reales al repositorio
- Cambia las credenciales por defecto antes de usar en producción
- El contenedor ejecuta como usuario no-root por seguridad
- Se aplican restricciones de capabilities por seguridad