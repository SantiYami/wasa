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
