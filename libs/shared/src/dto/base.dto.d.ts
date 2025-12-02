export declare class TBaseDTO<T> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
    constructor(success: boolean, data?: T, message?: string, error?: string);
    static success<T>(data: T, message?: string): TBaseDTO<T>;
    static error<T>(error: string, message?: string): TBaseDTO<T>;
}
