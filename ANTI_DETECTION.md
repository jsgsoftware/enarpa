# Configuración Anti-Detección para ENARPA

## Características Implementadas

### 1. Rotación de User Agents
- Se rotan automáticamente diferentes User Agents de navegadores reales
- Incluye versiones de Chrome en Windows, macOS y Linux

### 2. Headers Aleatorios
- Headers HTTP realistas que cambian en cada solicitud
- Incluye Accept-Language variado para simular usuarios de diferentes regiones

### 3. Viewports Aleatorios
- Diferentes resoluciones de pantalla para parecer más natural
- Simula usuarios con diferentes tamaños de pantalla

### 4. Anti-Detección de Automatización
- Elimina indicadores de que el navegador está siendo automatizado
- Modifica propiedades del objeto `navigator` para ocultar Puppeteer

### 5. Delays Aleatorios
- Tiempos de espera variables entre acciones
- Simula comportamiento humano real

### 6. Reintentos con Backoff Exponencial
- Sistema de reintentos automáticos en caso de errores
- Aumenta progresivamente el tiempo de espera entre intentos

### 7. Soporte para Proxies (Opcional)
- Rotación automática de proxies si están configurados
- Soporte para HTTP, HTTPS y SOCKS5

## Configuración de Proxies

### Paso 1: Obtener Proxies
Puedes obtener proxies de servicios como:
- [ProxyMesh](https://proxymesh.com/)
- [Bright Data](https://brightdata.com/)
- [Smartproxy](https://smartproxy.com/)
- [Proxy-Cheap](https://proxy-cheap.com/)

### Paso 2: Configurar Proxies
Edita el archivo `src/config/proxies.js`:

```javascript
const PROXY_LIST = [
  'http://proxy1.example.com:8080',
  'http://proxy2.example.com:8080',
  'socks5://proxy3.example.com:1080',
  
  // Para proxies con autenticación:
  'http://usuario:password@proxy.example.com:8080'
];
```

### Paso 3: Variables de Entorno (Opcional)
Puedes usar variables de entorno para los proxies:

```bash
# .env
PROXY_1=http://proxy1.example.com:8080
PROXY_2=http://proxy2.example.com:8080
PROXY_3=socks5://proxy3.example.com:1080
```

Y modificar `proxies.js`:
```javascript
const PROXY_LIST = [
  process.env.PROXY_1,
  process.env.PROXY_2,
  process.env.PROXY_3
].filter(Boolean); // Filtra valores undefined
```

## Uso Sin Proxies
El sistema funciona perfectamente sin proxies. Simplemente deja el array `PROXY_LIST` vacío en `src/config/proxies.js`.

## Monitoreo
El sistema incluye logs detallados:
- 🔄 User Agent utilizado
- 🌐 Proxy utilizado (si aplica)
- ⏱️ Delays entre consultas
- 🔍 Estado de cada consulta
- ❌ Errores detallados

## Recomendaciones Adicionales

### 1. Limitar Consultas Simultáneas
- No ejecutes múltiples instancias al mismo tiempo
- Usa delays entre consultas de diferentes endpoints

### 2. Monitorear Respuestas
- Si recibes muchos errores 429 (Too Many Requests), aumenta los delays
- Si recibes errores de CAPTCHA, considera usar proxies

### 3. Usar en Horarios de Menor Tráfico
- Evita hacer scraping en horarios pico
- Los fines de semana suelen tener menos restricciones

### 4. Rotar Sesiones
- El sistema reinicia automáticamente el navegador después de varios errores
- Esto ayuda a evitar la acumulación de estado

## Solución de Problemas

### Error: "Navigation timeout of 60000 ms exceeded"
- **Causa**: Página tarda mucho en cargar
- **Solución**: Ya aumentamos los timeouts a 90 segundos

### Error: "TimeoutError: waiting for function failed"
- **Causa**: reCAPTCHA no se carga
- **Solución**: El sistema incluye reintentos automáticos

### Error: "net::ERR_PROXY_CONNECTION_FAILED"
- **Causa**: Proxy no disponible
- **Solución**: Verifica la configuración del proxy o desactiva su uso

## Ejemplo de Uso
```bash
# Consulta sin proxies (configuración por defecto)
curl -X POST http://localhost:3000/api/consulta-placa \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tu_token" \
  -d '{"placas": ["ABC123", "DEF456"]}'
```

El sistema manejará automáticamente:
- Rotación de User Agents
- Delays aleatorios
- Reintentos en caso de error
- Rotación de proxies (si están configurados)