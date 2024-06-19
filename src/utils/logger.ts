import winston from 'winston';

const WINSTON_LOGFORM_FORMATS: winston.Logform.Format[] = [
  winston.format.colorize(), // https://github.com/winstonjs/logform#colorize
  winston.format.timestamp(),
  winston.format.simple(), // https://github.com/winstonjs/logform#simple -> `level: message stringifiedRest`
];

export const logger = winston.createLogger({
  format: winston.format.combine(...WINSTON_LOGFORM_FORMATS),
  level: 'info',
  transports: [new winston.transports.Console()],
});
