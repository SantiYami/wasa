import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { apiKeyAuth } from './middlewares/auth.middleware.js';
import { sessionRouter } from './routes/session.routes.js';
import { messageRouter } from './routes/message.routes.js';
import { baileysService } from './services/baileys.service.js';

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Healthcheck público
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    whatsapp: baileysService.getStatus(),
  });
});

// Middleware opcional de autenticación por API Key
app.use(apiKeyAuth);

// Rutas de la API
app.use('/api/session', sessionRouter);
app.use('/api/messages', messageRouter);

// Manejador de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

// Manejador de errores global
app.use((err, req, res, next) => {
  logger.error({ err }, 'Error no manejado en la aplicación');
  res.status(500).json({ error: 'Error interno del servidor', details: err.message });
});

// Iniciar servidor y servicio de Baileys
const server = app.listen(config.port, async () => {
  logger.info(`Servidor HTTP iniciado en http://localhost:${config.port}`);
  logger.info('Iniciando servicio de WhatsApp con Baileys...');
  await baileysService.init();
});

// Manejo de apagado elegante (Graceful Shutdown)
const shutdown = async () => {
  logger.info('Cerrando servidor...');
  server.close(() => {
    logger.info('Servidor HTTP cerrado.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
