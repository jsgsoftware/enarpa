# Usar imagen oficial de Node.js
FROM node:18-slim

# Instalar dependencias del sistema necesarias para Puppeteer
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-cdn.alpinelinux.org/alpine/v3.21/main/x86_64/APKINDEX.tar.gz || true \
    && apt-get install -y \
        fonts-liberation \
        libappindicator3-1 \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libcups2 \
        libdbus-1-3 \
        libgdk-pixbuf2.0-0 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libx11-xcb1 \
        libxcomposite1 \
        libxdamage1 \
        libxrandr2 \
        xdg-utils \
        libxss1 \
        libgconf-2-4 \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio de trabajo
WORKDIR /app

# Configurar Puppeteer para descargar Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false

# Copiar package.json y package-lock.json (si existe)
COPY package*.json ./

# Copiar el resto del código
COPY . .

# Configurar npm para SSL y instalar dependencias
RUN npm config set strict-ssl false
RUN npm install

# Exponer el puerto
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["node", "server.js"]