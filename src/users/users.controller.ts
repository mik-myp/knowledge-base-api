import { Body, Controller, Get, Post, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/utils/public.decorator';
import { ResponseUtil, SuccessResponse } from 'src/common/utils/response.util';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { UsersService } from './users.service';
import type {
  LogoutResult,
  TokenPairResult,
  UserProfile,
  UserRequest,
} from './users';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  @Public()
  async register(
    @Body() registerDto: RegisterDto,
  ): Promise<SuccessResponse<TokenPairResult>> {
    const result = await this.usersService.register(registerDto);
    return ResponseUtil.success<TokenPairResult>(result);
  }

  @Post('login')
  @Public()
  async login(
    @Body() loginDto: LoginDto,
  ): Promise<SuccessResponse<TokenPairResult>> {
    const result = await this.usersService.login(loginDto);
    return ResponseUtil.success<TokenPairResult>(result);
  }

  @Post('refresh')
  @Public()
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<SuccessResponse<TokenPairResult>> {
    const result = await this.usersService.refresh(refreshTokenDto);
    return ResponseUtil.success<TokenPairResult>(result);
  }

  @Post('logout')
  @ApiBearerAuth()
  async logout(
    @Request() req: UserRequest,
  ): Promise<SuccessResponse<LogoutResult>> {
    const result = await this.usersService.logout(req.user.userId);
    return ResponseUtil.success<LogoutResult>(result);
  }

  @Get('me')
  @ApiBearerAuth()
  async me(@Request() req: UserRequest): Promise<SuccessResponse<UserProfile>> {
    const result = await this.usersService.me(req.user.userId);
    return ResponseUtil.success<UserProfile>(result);
  }
}
