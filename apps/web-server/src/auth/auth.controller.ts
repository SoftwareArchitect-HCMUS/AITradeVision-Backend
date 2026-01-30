import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Request, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, AuthResponseDto, UpgradeVipResponseDto, PaymentDto, UpdateProfileDto, UpdateProfileResponseDto } from '@shared/dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TBaseDTO } from '@shared/dto/base.dto';

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
    const result = await this.authService.login(loginDto);
    return TBaseDTO.success(result, 'Login successful');
  }

  @Post('upgrade-vip')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upgrade user to VIP', description: 'Upgrade a user account to VIP status' })
  @ApiBody({ type: PaymentDto })
  @ApiResponse({ 
    status: 200, 
    description: 'VIP upgrade successful',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: '#/components/schemas/UpgradeVipResponseDto' },
        message: { type: 'string', example: 'VIP upgrade successful' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid payment information' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async upgradeVip(@Request() req: any, @Body() paymentDto: PaymentDto): Promise<TBaseDTO<UpgradeVipResponseDto>> {
    const result = await this.authService.upgradeVip(req.user.userId);
    return TBaseDTO.success(result, 'VIP upgrade successful');
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile', description: 'Update user profile information' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Profile updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: '#/components/schemas/UpdateProfileResponseDto' },
        message: { type: 'string', example: 'Profile updated successfully' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input or duplicate email/username' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(@Request() req: any, @Body() updateProfileDto: UpdateProfileDto): Promise<TBaseDTO<UpdateProfileResponseDto>> {
    const result = await this.authService.updateProfile(req.user.userId, updateProfileDto);
    return TBaseDTO.success(result, 'Profile updated successfully');
  }
}

