import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Регистрация представителя МСП' })
  @ApiResponse({ status: 201, description: 'Успешная регистрация и получение токена' })
  @ApiResponse({ status: 409, description: 'Телефон уже занят' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Авторизация по номеру телефона и паролю' })
  @ApiResponse({ status: 200, description: 'Успешный вход' })
  @ApiResponse({ status: 401, description: 'Неверные учетные данные' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получение текущего профиля авторизованного пользователя' })
  getProfile(@Req() req: any) {
    return req.user;
  }
}