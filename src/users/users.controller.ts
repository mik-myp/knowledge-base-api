import { Body, Controller, Get, Post, Request } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
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
  @ApiOperation({ summary: '用户注册' })
  @ApiBody({ type: RegisterDto })
  @ApiOkResponse({ description: '注册成功并返回 accessToken / refreshToken' })
  @ApiConflictResponse({ description: '邮箱或用户名已存在' })
  async register(
    @Body() registerDto: RegisterDto,
  ): Promise<SuccessResponse<TokenPairResult>> {
    const result = await this.usersService.register(registerDto);
    return ResponseUtil.success<TokenPairResult>(result);
  }

  @Post('login')
  @Public()
  @ApiOperation({ summary: '用户登录' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: '登录成功并返回 accessToken / refreshToken' })
  @ApiUnauthorizedResponse({ description: '邮箱或密码错误' })
  async login(
    @Body() loginDto: LoginDto,
  ): Promise<SuccessResponse<TokenPairResult>> {
    const result = await this.usersService.login(loginDto);
    return ResponseUtil.success<TokenPairResult>(result);
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: '刷新 accessToken' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({
    description: '刷新成功并返回新的 accessToken / refreshToken',
  })
  @ApiUnauthorizedResponse({ description: 'refreshToken 无效或已过期' })
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<SuccessResponse<TokenPairResult>> {
    const result = await this.usersService.refresh(refreshTokenDto);
    return ResponseUtil.success<TokenPairResult>(result);
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: '退出登录' })
  @ApiOkResponse({ description: '退出成功，并清除当前用户的 refreshToken' })
  @ApiUnauthorizedResponse({ description: '登录状态无效或 accessToken 已过期' })
  async logout(
    @Request() req: UserRequest,
  ): Promise<SuccessResponse<LogoutResult>> {
    const result = await this.usersService.logout(req.user.userId);
    return ResponseUtil.success<LogoutResult>(result);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前登录用户信息' })
  @ApiOkResponse({ description: '成功返回当前用户资料' })
  @ApiUnauthorizedResponse({ description: '登录状态无效或 accessToken 已过期' })
  async me(@Request() req: UserRequest): Promise<SuccessResponse<UserProfile>> {
    const result = await this.usersService.me(req.user.userId);
    return ResponseUtil.success<UserProfile>(result);
  }
}
