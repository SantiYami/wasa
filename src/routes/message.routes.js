import { Router } from 'express';
import { baileysService } from '../services/baileys.service.js';
import { logger } from '../utils/logger.js';

export const messageRouter = Router();

/**
 * POST /api/messages/send-text
 * Enviar mensaje de texto simple
 * Body: {
 *   "to": "573001234567" o "120363023456789012@g.us",
 *   "message": "Hola @573001234567",
 *   "mentions": ["573001234567"] // Opcional: auto-detecta @numeros del texto si no se pasa
 * }
 */
messageRouter.post('/send-text', async (req, res) => {
  const { to, message, mentions } = req.body;

  if (!to || !message) {
    return res.status(400).json({
      error: 'Los campos "to" y "message" son obligatorios.',
    });
  }

  try {
    const result = await baileysService.sendTextMessage(to, message, { mentions });
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Error enviando mensaje de texto');
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/messages/send-media
 * Enviar multimedia (imagen, documento, video o audio)
 * Body: {
 *   "to": "573001234567",
 *   "type": "image" | "document" | "video" | "audio",
 *   "url": "https://ejemplo.com/archivo.jpg", // o "base64": "..."
 *   "caption": "Opcional leyenda con @573001234567",
 *   "fileName": "documento.pdf",
 *   "mentions": ["573001234567"] // Opcional
 * }
 */
messageRouter.post('/send-media', async (req, res) => {
  const { to, type, url, base64, caption, fileName, mimetype, ptt, mentions } = req.body;

  if (!to || !type || (!url && !base64)) {
    return res.status(400).json({
      error: 'Los campos "to", "type" y ("url" o "base64") son obligatorios.',
    });
  }

  try {
    const result = await baileysService.sendMediaMessage(to, {
      type,
      url,
      base64,
      caption,
      fileName,
      mimetype,
      ptt,
      mentions,
    });
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Error enviando archivo multimedia');
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/messages/send-bulk
 * Enviar el mismo mensaje a múltiples destinatarios con delay para evitar bloqueos
 * Body: {
 *   "recipients": ["573001234567", "573009876543"],
 *   "message": "Hola a todos",
 *   "delayMs": 1500,
 *   "mentions": ["573001234567"] // Opcional
 * }
 */
messageRouter.post('/send-bulk', async (req, res) => {
  const { recipients, message, delayMs = 1500, mentions } = req.body;

  if (!Array.isArray(recipients) || recipients.length === 0 || !message) {
    return res.status(400).json({
      error: 'El campo "recipients" debe ser un array con al menos un destinatario y "message" es obligatorio.',
    });
  }

  const results = [];

  for (const to of recipients) {
    try {
      const sent = await baileysService.sendTextMessage(to, message, { mentions });
      results.push({ to, success: true, messageId: sent.messageId, mentions: sent.mentions });
    } catch (err) {
      results.push({ to, success: false, error: err.message });
    }

    if (delayMs > 0 && recipients.indexOf(to) < recipients.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  res.json({
    total: recipients.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  });
});
