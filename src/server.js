import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { apiKeyAuth } from './middlewares/auth.middleware.js';
import { sessionRouter } from './routes/session.routes.js';
import { messageRouter } from './routes/message.routes.js';
import { baileysService } from './services/baileys.service.js';

// Manejadores globales para evitar caídas imprevistas del proceso en producción 24/7
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Excepción no capturada (uncaughtException)');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Promesa rechazada no manejada (unhandledRejection)');
});

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Timeout de seguridad en peticiones HTTP (30s) para evitar conexiones colgadas en memoria
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    if (!res.headersSent) {
      logger.warn(`Timeout de petición HTTP en ${req.method} ${req.originalUrl}`);
      res.status(504).json({ error: 'Gateway Timeout: La solicitud excedió el tiempo límite de espera.' });
    }
  });
  next();
});

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
  if (!res.headersSent) {
    res.status(500).json({ error: 'Error interno del servidor', details: err.message });
  }
});

// Iniciar servidor y servicio de Baileys
const server = app.listen(config.port, async () => {
  logger.info(`Servidor HTTP iniciado en http://localhost:${config.port}`);
  logger.info('Iniciando servicio de WhatsApp con Baileys...');
  await baileysService.init();
});

// Manejo de apagado elegante (Graceful Shutdown)
const shutdown = async () => {
  logger.info('Cerrando servidor y liberando recursos...');

  try {
    baileysService._destroySocket();
  } catch (err) {
    logger.error({ err }, 'Error al liberar socket durante el apagado');
  }

  server.close(() => {
    logger.info('Servidor HTTP cerrado.');
    process.exit(0);
  });

  // Forzar salida si server.close() se demora más de 5 segundos
  setTimeout(() => {
    logger.warn('Forzando apagado tras timeout de espera.');
    process.exit(1);
  }, 5000).unref();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

