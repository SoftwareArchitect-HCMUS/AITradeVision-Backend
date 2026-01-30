import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';

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

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  username?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MinLength(6)
  @IsOptional()
  currentPassword?: string;

  @IsString()
  @MinLength(6)
  @IsOptional()
  newPassword?: string;
}

export class UpdateProfileResponseDto {
  success!: boolean;
  user!: {
    id: number;
    email: string;
    username: string;
    isVip: boolean;
  };
}

