import { config } from '../config/index.js';

/**
 * Middleware para validar API Key si está configurada en las variables de entorno.
 */
export function apiKeyAuth(req, res, next) {
  if (!config.apiKey) {
    return next();
  }

  const apiKeyHeader = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  const apiKeyQuery = req.query.apiKey;
  const providedKey = apiKeyHeader || apiKeyQuery;

  if (!providedKey || providedKey !== config.apiKey) {
    return res.status(401).json({
      error: 'No autorizado. Se requiere un header "x-api-key" válido.',
    });
  }

  next();
}
