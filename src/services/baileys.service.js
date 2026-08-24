import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import fs from 'fs';
import { rm } from 'fs/promises';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { formatToJid, extractMentions } from '../utils/jid.js';

export const ConnectionStatus = {
  DISCONNECTED: 'DISCONNECTED',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  QR_READY: 'QR_READY',
};

class BaileysService {
  constructor() {
    this.sock = null;
    this.status = ConnectionStatus.DISCONNECTED;
    this.qrRaw = null;
    this.qrImage = null;
    this.user = null;
    this.saveCreds = null;
    this.isInitializing = false;
  }

  /**
   * Inicializa la conexión con WhatsApp.
   */
  async init() {
    if (this.isInitializing) {
      logger.warn('La inicialización de Baileys ya está en progreso...');
      return;
    }

    this.isInitializing = true;
    this.status = ConnectionStatus.CONNECTING;

    try {
      if (!fs.existsSync(config.sessionDir)) {
        fs.mkdirSync(config.sessionDir, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);
      this.saveCreds = saveCreds;

      const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({
        version: [2, 3000, 1015901307],
        isLatest: false,
      }));

      logger.info(`Iniciando Baileys v${version.join('.')} (Latest: ${isLatest})`);

      // Silenciar logs internos de Baileys para evitar spam en consola (usar trace/error)
      const baileysLogger = logger.child({ module: 'baileys' });
      baileysLogger.level = 'error';

      this.sock = makeWASocket({
        version,
        logger: baileysLogger,
        printQRInTerminal: true,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
        },
        generateHighQualityLinkPreview: true,
        browser: ['Wasa', 'Chrome', '1.0.0'],
      });

      this._bindEvents();
    } catch (error) {
      logger.error({ err: error }, 'Error al inicializar Baileys');
      this.status = ConnectionStatus.DISCONNECTED;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Configura los listeners de eventos de Baileys.
   */
  _bindEvents() {
    this.sock.ev.on('creds.update', this.saveCreds);

    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qrRaw = qr;
        try {
          this.qrImage = await QRCode.toDataURL(qr);
        } catch (err) {
          logger.error({ err }, 'Error generando código QR en Base64');
        }
        this.status = ConnectionStatus.QR_READY;
        logger.info('Nuevo código QR generado y listo para escanear');
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        this.status = ConnectionStatus.DISCONNECTED;
        this.qrRaw = null;
        this.qrImage = null;
        this.user = null;

        logger.warn(`Conexión cerrada. Código razón: ${statusCode}. Reconectar: ${shouldReconnect}`);

        if (shouldReconnect) {
          logger.info('Intentando reconectar en 3 segundos...');
          setTimeout(() => this.init(), 3000);
        } else {
          logger.warn('Sesión cerrada permanentemente (Logged Out). Limpiando credenciales...');
          await this.clearSession();
        }
      } else if (connection === 'open') {
        this.status = ConnectionStatus.CONNECTED;
        this.qrRaw = null;
        this.qrImage = null;
        this.user = this.sock.user;
        logger.info(`WhatsApp conectado exitosamente como ${this.user?.name || this.user?.id}`);
      }
    });
  }

  /**
   * Obtiene el estado actual de la sesión.
   */
  getStatus() {
    return {
      status: this.status,
      connected: this.status === ConnectionStatus.CONNECTED,
      user: this.user,
      qrAvailable: !!this.qrRaw,
    };
  }

  /**
   * Retorna la información del código QR en texto y DataURL.
   */
  getQR() {
    if (this.status === ConnectionStatus.CONNECTED) {
      return {
        status: this.status,
        message: 'La sesión ya está conectada. No se requiere código QR.',
      };
    }

    if (!this.qrRaw) {
      return {
        status: this.status,
        message: 'El código QR no está disponible en este momento. Espera un instante o reinicia la sesión.',
      };
    }

    return {
      status: this.status,
      qrRaw: this.qrRaw,
      qrImage: this.qrImage,
    };
  }

  /**
   * Solicita un código de emparejamiento (Pairing Code de 8 dígitos) por número de teléfono.
   * 
   * @param {string} phoneNumber - Número de teléfono en formato internacional (ej. 573001234567)
   */
  async requestPairingCode(phoneNumber) {
    if (this.status === ConnectionStatus.CONNECTED) {
      throw new Error('La sesión ya está conectada.');
    }

    if (!this.sock) {
      await this.init();
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      throw new Error('Número de teléfono inválido para generar código de emparejamiento.');
    }

    try {
      const code = await this.sock.requestPairingCode(cleanPhone);
      logger.info(`Pairing Code generado para ${cleanPhone}: ${code}`);
      return {
        phoneNumber: cleanPhone,
        code,
        message: 'Ingresa este código en tu WhatsApp > Dispositivos vinculados > Vincular con el número de teléfono',
      };
    } catch (error) {
      logger.error({ err: error }, 'Error solicitando Pairing Code');
      throw new Error(`Error generando Pairing Code: ${error.message}`);
    }
  }

  /**
   * Obtiene la lista de grupos en los que participa la cuenta conectada.
   */
  async getGroups() {
    if (this.status !== ConnectionStatus.CONNECTED || !this.sock) {
      throw new Error('No hay una sesión activa de WhatsApp conectada.');
    }

    try {
      const groups = await this.sock.groupFetchAllParticipating();
      return Object.values(groups).map((g) => ({
        id: g.id,
        subject: g.subject,
        owner: g.owner,
        creation: g.creation,
        participantsCount: g.participants ? g.participants.length : 0,
      }));
    } catch (error) {
      logger.error({ err: error }, 'Error obteniendo lista de grupos');
      throw new Error(`Error obteniendo grupos: ${error.message}`);
    }
  }

  /**
   * Envía un mensaje de texto simple.
   * 
   * @param {string} to - Destinatario (número o JID)
   * @param {string} message - Texto del mensaje
   * @param {object} [options] - Opciones adicionales de mensaje
   */
  async sendTextMessage(to, message, options = {}) {
    if (this.status !== ConnectionStatus.CONNECTED || !this.sock) {
      throw new Error('No hay una sesión activa de WhatsApp conectada.');
    }

    if (!message || typeof message !== 'string') {
      throw new Error('El campo "message" es obligatorio y debe ser un string.');
    }

    const jid = formatToJid(to);
    const { mentions: explicitMentions, ...otherOptions } = options;
    const mentions = extractMentions(message, explicitMentions);

    const messagePayload = { text: message, ...otherOptions };
    if (mentions.length > 0) {
      messagePayload.mentions = mentions;
      logger.info({ mentions }, `Menciones incluidas en el mensaje: ${mentions.join(', ')}`);
    }

    logger.info(`Enviando mensaje de texto a ${jid}`);

    const result = await this.sock.sendMessage(jid, messagePayload);
    return {
      success: true,
      to: jid,
      messageId: result.key.id,
      timestamp: result.messageTimestamp,
      mentions: mentions.length > 0 ? mentions : undefined,
    };
  }

  /**
   * Envía un archivo multimedia (imagen, video, audio, documento) por URL o Buffer.
   * 
   * @param {string} to - Destinatario (número o JID)
   * @param {object} media - Objeto con los datos del media
   * @param {string} media.type - Tipo: 'image' | 'video' | 'audio' | 'document'
   * @param {string} [media.url] - URL pública del archivo
   * @param {string} [media.base64] - Archivo en base64
   * @param {string} [media.caption] - Leyenda del archivo
   * @param {string} [media.fileName] - Nombre de archivo (para documentos)
   * @param {string} [media.mimetype] - Mimetype explícito
   * @param {boolean} [media.ptt] - Si es nota de voz (audio tipo PTT)
   * @param {string[]|string} [media.mentions] - Menciones explícitas
   */
  async sendMediaMessage(to, { type, url, base64, caption, fileName, mimetype, ptt = false, mentions: explicitMentions }) {
    if (this.status !== ConnectionStatus.CONNECTED || !this.sock) {
      throw new Error('No hay una sesión activa de WhatsApp conectada.');
    }

    const jid = formatToJid(to);
    const validTypes = ['image', 'video', 'audio', 'document'];
    if (!validTypes.includes(type)) {
      throw new Error(`Tipo de multimedia no soportado: "${type}". Tipos válidos: ${validTypes.join(', ')}`);
    }

    let mediaContent;
    if (url) {
      mediaContent = { url };
    } else if (base64) {
      const cleanBase64 = base64.replace(/^data:.*?;base64,/, '');
      mediaContent = Buffer.from(cleanBase64, 'base64');
    } else {
      throw new Error('Debes proporcionar "url" o "base64" para el archivo multimedia.');
    }

    const messagePayload = {};
    messagePayload[type] = mediaContent;

    if (caption && (type === 'image' || type === 'video' || type === 'document')) {
      messagePayload.caption = caption;
    }
    if (fileName && type === 'document') {
      messagePayload.fileName = fileName;
    }
    if (mimetype) {
      messagePayload.mimetype = mimetype;
    }
    if (type === 'audio' && ptt) {
      messagePayload.ptt = true;
    }

    const mentions = extractMentions(caption, explicitMentions);
    if (mentions.length > 0) {
      messagePayload.mentions = mentions;
      logger.info({ mentions }, `Menciones incluidas en multimedia: ${mentions.join(', ')}`);
    }

    logger.info(`Enviando archivo multimedia [${type}] a ${jid}`);
    const result = await this.sock.sendMessage(jid, messagePayload);

    return {
      success: true,
      to: jid,
      type,
      messageId: result.key.id,
      timestamp: result.messageTimestamp,
      mentions: mentions.length > 0 ? mentions : undefined,
    };
  }

  /**
   * Cierra la sesión activa y elimina las credenciales locales.
   */
  async clearSession() {
    try {
      if (this.sock) {
        await this.sock.logout().catch(() => {});
      }
    } catch (e) {
      // Ignorar si ya estaba cerrado
    }

    this.sock = null;
    this.status = ConnectionStatus.DISCONNECTED;
    this.qrRaw = null;
    this.qrImage = null;
    this.user = null;

    if (fs.existsSync(config.sessionDir)) {
      await rm(config.sessionDir, { recursive: true, force: true }).catch((err) => {
        logger.error({ err }, 'Error eliminando directorio de sesión');
      });
    }

    logger.info('Sesión y credenciales eliminadas.');
  }

  /**
   * Reinicia la conexión.
   */
  async restart() {
    logger.info('Reiniciando conexión de Baileys...');
    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch (e) {}
    }
    await this.init();
  }
}

export const baileysService = new BaileysService();
