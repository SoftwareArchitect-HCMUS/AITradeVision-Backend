import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, AuthResponseDto } from '@shared/dto/auth.dto';
import { TBaseDTO } from '@shared/dto/base.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * Authentication controller
 */
@ApiTags('auth')
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
  @ApiOperation({ summary: 'Register a new user', description: 'Create a new user account with email, username, and password' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ 
    status: 201, 
    description: 'User registered successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: '#/components/schemas/AuthResponseDto' },
        message: { type: 'string', example: 'User registered successfully' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input or user already exists' })
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
  @ApiOperation({ summary: 'Login user', description: 'Authenticate user with email and password, returns JWT token' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: '#/components/schemas/AuthResponseDto' },
        message: { type: 'string', example: 'Login successful' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto): Promise<TBaseDTO<AuthResponseDto>> {
    try {
      const result = await this.authService.login(loginDto);
      return TBaseDTO.success(result, 'Login successful');
    } catch (error) {
      return TBaseDTO.error(error.message || 'Login failed');
    }
  }

  /**
   * Upgrade user to VIP (Demo feature)
   * @returns Updated auth response with VIP status
   */
  @Post('upgrade-vip')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Upgrade to VIP', description: 'Upgrade current user to VIP status (demo feature)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Upgraded to VIP successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: '#/components/schemas/AuthResponseDto' },
        message: { type: 'string', example: 'Upgraded to VIP successfully' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async upgradeToVIP(@Request() req: any): Promise<TBaseDTO<AuthResponseDto>> {
    try {
      const userId = req.user.userId;
      const result = await this.authService.upgradeToVIP(userId);
      return TBaseDTO.success(result, 'Upgraded to VIP successfully');
    } catch (error) {
      return TBaseDTO.error(error.message || 'Failed to upgrade to VIP');
    }
  }
}

