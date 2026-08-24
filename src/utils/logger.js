import { execSync } from 'child_process';
import pino from 'pino';
import pinoPretty from 'pino-pretty';
import { config } from '../config/index.js';

// En Windows, configurar la consola para usar UTF-8 (Code Page 65001) para que los acentos no se corrompan
if (process.platform === 'win32') {
  try {
    execSync('chcp 65001', { stdio: 'ignore' });
  } catch {
    // Silencioso en caso de entornos con permisos restringidos
  }
}

const stream = pinoPretty({
  colorize: true,
  ignore: 'pid,hostname',
  translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
});

export const logger = pino(
  {
    level: config.logLevel,
  },
  stream
);

