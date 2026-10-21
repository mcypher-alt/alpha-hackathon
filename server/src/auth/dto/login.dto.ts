import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: '+79991234567', description: 'Номер телефона' })
  @IsPhoneNumber('RU', { message: 'Некорректный формат номера телефона (РФ)' })
  phone: string;

  @ApiProperty({ example: 'SecurePass123!', description: 'Пароль' })
  @IsString()
  @MinLength(6)
  password: string;
}