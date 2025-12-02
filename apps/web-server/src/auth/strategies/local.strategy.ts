import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

/**
 * Local authentication strategy (email/password)
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
    });
  }

  /**
   * Validate user credentials
   * @param email - User email
   * @param password - User password
   * @returns User data
   */
  async validate(email: string, password: string): Promise<any> {
    const user = await this.authService.login({ email, password });
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}

