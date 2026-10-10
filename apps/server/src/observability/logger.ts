import pino from "pino";

export type AppLogger = {
  info(bindings: object, message?: string): void;
  warn(bindings: object, message?: string): void;
  error(bindings: object, message?: string): void;
};

export function createLogger(level: string) {
  return pino({ level });
}
