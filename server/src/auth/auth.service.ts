import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (existing) {
      throw new ConflictException('Пользователь с таким номером телефона уже зарегистрирован');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        passwordHash,
        fullName: dto.fullName,
        position: dto.position,
      },
      select: {
        id: true,
        phone: true,
        fullName: true,
        position: true,
        role: true,
      },
    });

    const token = this.generateToken(user.id, user.phone, user.role);

    return { user, accessToken: token };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (!user) {
      throw new UnauthorizedException('Неверный номер телефона или пароль');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Неверный номер телефона или пароль');
    }

    const token = this.generateToken(user.id, user.phone, user.role);

    return {
      user: {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName,
        position: user.position,
        role: user.role,
      },
      accessToken: token,
    };
  }

  private generateToken(userId: string, phone: string, role: string): string {
    const payload = { sub: userId, phone, role };
    return this.jwtService.sign(payload);
  }
}