import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, AuthResponseDto } from '@shared/dto/auth.dto';
import { TBaseDTO } from '@shared/dto/base.dto';

/**
 * Authentication controller
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user
   * @param registerDto - Registration data
   * @returns Registration response
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto): Promise<TBaseDTO<AuthResponseDto>> {
    try {
      const result = await this.authService.register(registerDto);
      return TBaseDTO.success(result, 'User registered successfully');
    } catch (error) {
      return TBaseDTO.error(error.message || 'Registration failed');
    }
  }

  /**
   * Login user
   * @param loginDto - Login credentials
   * @returns Login response
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<TBaseDTO<AuthResponseDto>> {
    try {
      const result = await this.authService.login(loginDto);
      return TBaseDTO.success(result, 'Login successful');
    } catch (error) {
      return TBaseDTO.error(error.message || 'Login failed');
    }
  }
}

