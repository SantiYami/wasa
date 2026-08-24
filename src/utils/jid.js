/**
 * Normaliza un número de teléfono o ID al formato JID requerido por WhatsApp/Baileys.
 * 
 * @param {string} input - Número de teléfono o JID
 * @returns {string} JID formateado
 */
export function formatToJid(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('El destinatario ("to") debe ser un texto válido con el número o JID.');
  }

  const trimmed = input.trim();

  // Si ya tiene dominio (@s.whatsapp.net, @g.us, etc.), devolver tal cual
  if (trimmed.includes('@')) {
    return trimmed;
  }

  // Quitar cualquier carácter no numérico (+, -, espacios, paréntesis, etc.)
  const cleanNumber = trimmed.replace(/\D/g, '');

  if (!cleanNumber || cleanNumber.length < 7) {
    throw new Error(`Número de teléfono inválido: "${input}".`);
  }

  return `${cleanNumber}@s.whatsapp.net`;
}

/**
 * Extrae menciones desde el texto (@57300...) y las combina con menciones explícitas.
 * Retorna un array de JIDs normalizados (@s.whatsapp.net).
 * 
 * @param {string} [text] - Texto que puede contener menciones (@numero)
 * @param {string[]|string} [explicitMentions] - Lista de números o JIDs explícitos
 * @returns {string[]} Lista de JIDs únicos
 */
export function extractMentions(text = '', explicitMentions = []) {
  const mentionsSet = new Set();

  // 1. Extraer menciones con regex del texto si existe
  if (typeof text === 'string' && text) {
    const matches = text.match(/@(\d{7,16})/g);
    if (matches) {
      for (const match of matches) {
        const phone = match.replace('@', '');
        try {
          mentionsSet.add(formatToJid(phone));
        } catch {
          // Ignorar si no es un formato válido
        }
      }
    }
  }

  // 2. Procesar menciones explícitas si se enviaron
  const explicitArray = Array.isArray(explicitMentions)
    ? explicitMentions
    : explicitMentions ? [explicitMentions] : [];

  for (const item of explicitArray) {
    if (typeof item === 'string' && item.trim()) {
      try {
        mentionsSet.add(formatToJid(item));
      } catch {
        // Ignorar si el formato es inválido
      }
    }
  }

  return Array.from(mentionsSet);
}
