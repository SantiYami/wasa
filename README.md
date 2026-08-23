# Wasa 🚀

A lightweight, headless WhatsApp REST API for sending messages, media, and managing connection sessions using [`@whiskeysockets/baileys`](https://baileys.wiki/).

---

## 🚀 Requisitos e Instalación

1. **Instalar dependencias:**
   ```bash
   pnpm install
   ```

2. **Configurar variables de entorno:**
   Copia `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```

   Variables disponibles en `.env`:
   ```ini
   PORT=3000
   API_KEY=               # Opcional: si se define, se requerirá el header x-api-key
   SESSION_DIR=./sessions # Directorio local donde se guardan las credenciales
   LOG_LEVEL=info
   ```

3. **Iniciar el servidor:**
   - Modo desarrollo (con autoreload):
     ```bash
     pnpm dev
     ```
   - Modo producción:
     ```bash
     pnpm start
     ```

---

## 📱 Métodos de Vinculación

Puedes vincular tu WhatsApp de dos maneras:
1. **Escaneando el Código QR**: Se muestra directamente en la terminal al arrancar o puedes consultarlo vía API en `GET /api/session/qr`.
2. **Con Código de Emparejamiento (Pairing Code)**: Sin usar la cámara, solicitando un código de 8 dígitos vía `POST /api/session/pair`.

---

## 📡 Endpoints de la API

### 1. Healthcheck
- **`GET /health`**
  - Retorna estado del servidor y estado de la conexión de WhatsApp.

---

### 2. Configuración y Sesión (`/api/session`)

#### **`GET /api/session/status`**
Consulta el estado de la sesión (`DISCONNECTED`, `CONNECTING`, `QR_READY`, `CONNECTED`).
```json
{
  "status": "QR_READY",
  "connected": false,
  "user": null,
  "qrAvailable": true
}
```

#### **`GET /api/session/qr`**
Obtiene el código QR en texto plano y en formato imagen Base64 (Data URL) para incrustar en un `<img>` o visor.
```json
{
  "status": "QR_READY",
  "qrRaw": "2@...",
  "qrImage": "data:image/png;base64,iVBORw0KGgoAAAANSU..."
}
```

#### **`GET /api/session/groups`**
Lista todos los grupos en los que participa la cuenta conectada, incluyendo sus IDs (`...`@g.us), nombres y número de participantes.
```json
[
  {
    "id": "120363023456789012@g.us",
    "subject": "Equipo de Desarrollo",
    "participantsCount": 15
  }
]
```

#### **`POST /api/session/pair`**
Genera un código de 8 dígitos para vincular con el número de teléfono desde WhatsApp > Dispositivos vinculados > Vincular con el número de teléfono.
```json
// Body:
{
  "phoneNumber": "573001234567"
}
```

#### **`POST /api/session/restart`**
Fuerza el reinicio de la conexión del socket de WhatsApp.

#### **`POST /api/session/logout`**
Cierra la sesión y elimina las credenciales locales de `./sessions` para iniciar una nueva cuenta limpia.

---

### 3. Envío de Mensajes (`/api/messages`)

> [!NOTE]
> El campo `to` acepta el número con código de país (ej. `573001234567`), con signos (ej. `+57 300 123 4567`) o en formato JID (`573001234567@s.whatsapp.net` o grupos `123456@g.us`). Se normaliza automáticamente.

#### **`POST /api/messages/send-text`**
Envía un mensaje de texto simple.
```json
// Body:
{
  "to": "573001234567",
  "message": "¡Hola! Mensaje enviado desde Wasa."
}
```
**Respuesta:**
```json
{
  "success": true,
  "to": "573001234567@s.whatsapp.net",
  "messageId": "3EB0ABC12345",
  "timestamp": 1724430000
}
```

#### **`POST /api/messages/send-media`**
Envía imágenes, audios/notas de voz, videos o documentos por URL o Base64.
```json
// Enviar Imagen por URL:
{
  "to": "573001234567",
  "type": "image",
  "url": "https://images.unsplash.com/photo-1579202673506-ca3ce28943ef",
  "caption": "Foto de prueba"
}

// Enviar Documento PDF:
{
  "to": "573001234567",
  "type": "document",
  "url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
  "fileName": "factura.pdf",
  "mimetype": "application/pdf"
}

// Enviar Nota de voz (PTT):
{
  "to": "573001234567",
  "type": "audio",
  "url": "https://ejemplo.com/audio.mp3",
  "ptt": true
}
```

#### **`POST /api/messages/send-bulk`**
Envía el mismo mensaje a una lista de destinatarios con un delay entre envíos (en milisegundos) para proteger el número contra bloqueos.
```json
// Body:
{
  "recipients": [
    "573001112233",
    "573004445566"
  ],
  "message": "Aviso importante a la comunidad.",
  "delayMs": 2000
}
```

---

## 🔒 Autenticación Opcional con API Key

Si configuras `API_KEY=mi_super_secreto` en `.env`, debes enviar la cabecera en todas las peticiones a `/api/*`:
```http
x-api-key: mi_super_secreto
```
O bien:
```http
Authorization: Bearer mi_super_secreto
```
