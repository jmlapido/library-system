/** Structured service error with a machine-readable code for HTTP mapping. */
export class AppError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'AppError';
  }
}
