/**
 * Domain-level error types for the application.
 * These errors represent business logic failures, not infrastructure failures.
 */

export type DomainErrorKind =
  | 'NotFound'
  | 'Validation'
  | 'Storage'
  | 'Tts'
  | 'FileSystem';

export interface DomainError {
  kind: DomainErrorKind;
  message: string;
}

export class AppError extends Error {
  constructor(
    public readonly kind: DomainErrorKind,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }

  static notFound(message: string): AppError {
    return new AppError('NotFound', message);
  }

  static validation(message: string): AppError {
    return new AppError('Validation', message);
  }

  static storage(message: string): AppError {
    return new AppError('Storage', message);
  }

  static tts(message: string): AppError {
    return new AppError('Tts', message);
  }

  static fileSystem(message: string): AppError {
    return new AppError('FileSystem', message);
  }

  toJSON(): DomainError {
    return {
      kind: this.kind,
      message: this.message,
    };
  }

  static fromDomainError(error: DomainError): AppError {
    return new AppError(error.kind, error.message);
  }
}

/**
 * Type guard to check if an error is a DomainError
 */
export function isDomainError(error: unknown): error is DomainError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'kind' in error &&
    'message' in error &&
    typeof (error as DomainError).kind === 'string' &&
    typeof (error as DomainError).message === 'string'
  );
}
