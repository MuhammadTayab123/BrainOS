import { AppError } from "./AppError";

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required.") {
    super({
      message,
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  }
}