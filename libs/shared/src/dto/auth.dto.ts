import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * DTO for user registration
 */
export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsString()
  @IsNotEmpty()
  username!: string;
}

/**
 * DTO for user login
 */
export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

/**
 * Response DTO for authentication
 */
export class AuthResponseDto {
  token!: string;
  user!: {
    id: number;
    email: string;
    username: string;
    isVip?: boolean;
  };
}

export class UpgradeVipResponseDto {
  success!: boolean;
  user!: {
    id: number;
    email: string;
    username: string;
    isVip: boolean;
  };
}

export class PaymentDto {
  @IsString()
  @IsNotEmpty()
  cardNumber!: string;

  @IsString()
  @IsNotEmpty()
  expiry!: string;

  @IsString()
  @IsNotEmpty()
  cvv!: string;
}

