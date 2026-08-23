import 'dotenv/config';
import path from 'path';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  apiKey: process.env.API_KEY || null,
  sessionDir: path.resolve(process.cwd(), process.env.SESSION_DIR || './sessions'),
  logLevel: process.env.LOG_LEVEL || 'info',
};
