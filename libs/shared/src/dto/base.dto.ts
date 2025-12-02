/**
 * Base DTO response wrapper
 */
export class TBaseDTO<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;

  constructor(success: boolean, data?: T, message?: string, error?: string) {
    this.success = success;
    this.data = data;
    this.message = message;
    this.error = error;
  }

  static success<T>(data: T, message?: string): TBaseDTO<T> {
    return new TBaseDTO(true, data, message);
  }

  static error<T>(error: string, message?: string): TBaseDTO<T> {
    return new TBaseDTO<T>(false, undefined, message, error);
  }
}

