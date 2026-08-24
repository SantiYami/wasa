import pino from 'pino';
import pinoPretty from 'pino-pretty';
import { config } from '../config/index.js';

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

