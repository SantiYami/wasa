import { Router } from 'express';
import { baileysService } from '../services/baileys.service.js';

export const sessionRouter = Router();

/**
 * GET /api/session/status
 * Retorna el estado actual de la conexión de WhatsApp
 */
sessionRouter.get('/status', (req, res) => {
  const status = baileysService.getStatus();
  res.json(status);
});

/**
 * GET /api/session/qr
 * Retorna el código QR en texto y como imagen Data URL Base64
 */
sessionRouter.get('/qr', (req, res) => {
  const qrData = baileysService.getQR();
  res.json(qrData);
});

/**
 * GET /api/session/groups
 * Retorna la lista de grupos en los que participa la cuenta conectada con sus IDs
 */
sessionRouter.get('/groups', async (req, res) => {
  try {
    const groups = await baileysService.getGroups();
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/session/pair
 * Genera un código de emparejamiento (Pairing Code) para vincular con número telefónico
 * Body: { phoneNumber: "573001234567" }
 */
sessionRouter.post('/pair', async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({
      error: 'El campo "phoneNumber" es requerido (ej: "573001234567").',
    });
  }

  try {
    const result = await baileysService.requestPairingCode(phoneNumber);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/session/restart
 * Fuerza la reconexión del socket
 */
sessionRouter.post('/restart', async (req, res) => {
  try {
    await baileysService.restart();
    res.json({ message: 'Reconexión iniciada con éxito.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/session/logout
 * Cierra sesión y elimina credenciales locales
 */
sessionRouter.post('/logout', async (req, res) => {
  try {
    await baileysService.clearSession();
    // Iniciar de nuevo en blanco para que quede listo para un nuevo QR
    await baileysService.init();
    res.json({ message: 'Sesión cerrada y credenciales eliminadas. Listo para nuevo vínculo.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
