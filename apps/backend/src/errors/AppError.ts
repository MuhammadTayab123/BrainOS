export interface AppErrorOptions {
  message: string;
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor({
    message,
    statusCode = 500,
    code = "INTERNAL_SERVER_ERROR",
    isOperational = true,
  }: AppErrorOptions) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}