import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserEntity } from './entities/user.entity';
import { RegisterDto, LoginDto, AuthResponseDto } from '@shared/dto/auth.dto';

/**
 * Authentication service
 */
@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 10;

  constructor(
    @InjectRepository(UserEntity, 'main')
    private userRepository: Repository<UserEntity>,
    private jwtService: JwtService,
  ) {}

  /**
   * Register a new user
   * @param registerDto - Registration data
   * @returns Authentication response
   */
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: [{ email: registerDto.email }, { username: registerDto.username }],
    });

    if (existingUser) {
      throw new UnauthorizedException('User with this email or username already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(registerDto.password, this.SALT_ROUNDS);

    // Create user
    const user = this.userRepository.create({
      email: registerDto.email,
      username: registerDto.username,
      passwordHash,
    });

    const savedUser = await this.userRepository.save(user);

    // Generate JWT token
    const token = this.jwtService.sign({
      sub: savedUser.id,
      email: savedUser.email,
      username: savedUser.username,
    });

    return {
      token,
      user: {
        id: savedUser.id,
        email: savedUser.email,
        username: savedUser.username,
        isVIP: savedUser.isVIP || false,
      },
    };
  }

  /**
   * Login user
   * @param loginDto - Login credentials
   * @returns Authentication response
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      username: user.username,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isVIP: user.isVIP || false,
      },
    };
  }

  /**
   * Validate user by ID
   * @param userId - User ID
   * @returns User entity or null
   */
  async validateUser(userId: number): Promise<UserEntity | null> {
    return this.userRepository.findOne({ where: { id: userId } });
  }

  /**
   * Upgrade user to VIP (Demo feature)
   * @param userId - User ID
   * @returns Updated authentication response
   */
  async upgradeToVIP(userId: number): Promise<AuthResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Update user to VIP
    user.isVIP = true;
    await this.userRepository.save(user);

    // Generate new JWT token with updated info
    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      username: user.username,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isVIP: user.isVIP,
      },
    };
  }
}

