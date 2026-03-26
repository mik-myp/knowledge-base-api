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
} from './types/users.types';
/**
 * 负责用户相关接口处理的控制器。
 */
@ApiTags('用户')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * 处理用户注册。
   * @param registerDto 注册请求参数，包含用户名、邮箱和密码。
   * @returns 返回 Promise，解析后得到SuccessResponse<Token对Result>。
   */
  @Post('register')
  @Public()
  @ApiOperation({ summary: '用户注册' })
  @ApiBody({ type: RegisterDto })
  @ApiOkResponse({ description: '注册成功并返回访问令牌和刷新令牌' })
  @ApiConflictResponse({ description: '邮箱或用户名已存在' })
  async register(
    @Body() registerDto: RegisterDto,
  ): Promise<SuccessResponse<TokenPairResult>> {
    const result = await this.usersService.register(registerDto);
    return ResponseUtil.success<TokenPairResult>(result);
  }

  /**
   * 处理用户登录。
   * @param loginDto 登录请求参数，包含邮箱和密码。
   * @returns 返回 Promise，解析后得到SuccessResponse<Token对Result>。
   */
  @Post('login')
  @Public()
  @ApiOperation({ summary: '用户登录' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: '登录成功并返回访问令牌和刷新令牌' })
  @ApiUnauthorizedResponse({ description: '邮箱或密码错误' })
  async login(
    @Body() loginDto: LoginDto,
  ): Promise<SuccessResponse<TokenPairResult>> {
    const result = await this.usersService.login(loginDto);
    return ResponseUtil.success<TokenPairResult>(result);
  }

  /**
   * 刷新令牌。
   * @param refreshTokenDto 刷新令牌请求参数。
   * @returns 返回 Promise，解析后得到SuccessResponse<Token对Result>。
   */
  @Post('refresh')
  @Public()
  @ApiOperation({ summary: '刷新访问令牌' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({
    description: '刷新成功并返回新的访问令牌和刷新令牌',
  })
  @ApiUnauthorizedResponse({ description: '刷新令牌无效或已过期' })
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<SuccessResponse<TokenPairResult>> {
    const result = await this.usersService.refresh(refreshTokenDto);
    return ResponseUtil.success<TokenPairResult>(result);
  }

  /**
   * 处理用户退出登录。
   * @param req 请求对象。
   * @returns 返回 Promise，解析后得到SuccessResponse<LogoutResult>。
   */
  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: '退出登录' })
  @ApiOkResponse({ description: '退出成功，并清除当前用户的刷新令牌' })
  @ApiUnauthorizedResponse({ description: '登录状态无效或访问令牌已过期' })
  async logout(
    @Request() req: UserRequest,
  ): Promise<SuccessResponse<LogoutResult>> {
    const result = await this.usersService.logout(req.user.userId);
    return ResponseUtil.success<LogoutResult>(result);
  }

  /**
   * 获取当前用户信息。
   * @param req 请求对象。
   * @returns 返回 Promise，解析后得到SuccessResponse<UserProfile>。
   */
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前登录用户信息' })
  @ApiOkResponse({ description: '成功返回当前用户资料' })
  @ApiUnauthorizedResponse({ description: '登录状态无效或访问令牌已过期' })
  async me(@Request() req: UserRequest): Promise<SuccessResponse<UserProfile>> {
    const result = await this.usersService.me(req.user.userId);
    return ResponseUtil.success<UserProfile>(result);
  }
}
