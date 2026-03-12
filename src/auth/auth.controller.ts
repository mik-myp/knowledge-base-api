import { Controller, Get, Post, Body, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ResponseUtil } from 'src/common/utils/response.util';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from 'src/common/utils/public.decorator';

type AuthRequest = {
  user: {
    userId: string;
  };
};

type SuccessResponse<T> = {
  code: number;
  message: string;
  data: T;
  timestamp: string;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  async register(
    @Body() registerDto: RegisterDto,
  ): Promise<SuccessResponse<string>> {
    const result = await this.authService.register(registerDto);
    return ResponseUtil.success(result);
  }

  @Post('login')
  @Public()
  async login(@Body() loginDto: LoginDto): Promise<SuccessResponse<string>> {
    const result = await this.authService.login(loginDto);
    return ResponseUtil.success(result);
  }

  @Post('refresh')
  @Public()
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<SuccessResponse<string>> {
    const result = await this.authService.refresh(refreshTokenDto);
    return ResponseUtil.success(result);
  }

  @Post('logout')
  async logout(@Request() req: AuthRequest): Promise<SuccessResponse<string>> {
    const result = await this.authService.logout(req.user.userId);
    return ResponseUtil.success(result);
  }

  @Get('me')
  async me(@Request() req: AuthRequest): Promise<SuccessResponse<string>> {
    const result = await this.authService.me(req.user.userId);
    return ResponseUtil.success(result);
  }
}
