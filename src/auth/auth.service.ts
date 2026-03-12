import { Injectable } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Injectable()
export class AuthService {
  constructor() {}
  async register(registerDto: RegisterDto): Promise<string> {
    void registerDto;
    return 'This action adds a new auth';
  }

  async login(loginDto: LoginDto): Promise<string> {
    void loginDto;
    return 'This action adds a new auth';
  }
  async refresh(refreshTokenDto: RefreshTokenDto): Promise<string> {
    void refreshTokenDto;
    return 'This action adds a new auth';
  }
  async logout(userId: string): Promise<string> {
    void userId;
    return 'This action adds a new auth';
  }
  async me(userId: string): Promise<string> {
    void userId;
    return 'This action adds a new auth';
  }
}
