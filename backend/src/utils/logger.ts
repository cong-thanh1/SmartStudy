export type LogLevel = "debug" | "error" | "info" | "warn";

export interface LogEntry {
  readonly [key: string]: unknown;
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: string;
}

export class Logger {
  constructor(private readonly minLevel: LogLevel = "info") {}

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      error: 3,
      info: 1,
      warn: 2,
    };
    return levels[level] >= levels[this.minLevel];
  }

  log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) {
      return;
    }
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };
    const jsonStr = JSON.stringify(entry);
    if (level === "error") {
      console.error(jsonStr);
    } else if (level === "warn") {
      console.warn(jsonStr);
    } else {
      console.log(jsonStr);
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log("info", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log("error", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log("warn", message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log("debug", message, meta);
  }
}

export const logger = new Logger(
  (process.env.LOG_LEVEL as LogLevel) ?? "info",
);
