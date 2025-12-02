export declare class RegisterDto {
    email: string;
    password: string;
    username: string;
}
export declare class LoginDto {
    email: string;
    password: string;
}
export declare class AuthResponseDto {
    token: string;
    user: {
        id: number;
        email: string;
        username: string;
    };
}
