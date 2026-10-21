import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsPhoneNumber, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: '+79991234567', description: 'Номер телефона' })
  @IsPhoneNumber('RU', { message: 'Некорректный формат номера телефона (РФ)' })
  phone: string;

  @ApiProperty({ example: 'SecurePass123!', description: 'Пароль (минимум 6 символов)' })
  @IsString()
  @MinLength(6, { message: 'Пароль должен содержать не менее 6 символов' })
  password: string;

  @ApiProperty({ example: 'Иванов Иван Иванович', description: 'ФИО' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'Генеральный директор', description: 'Должность в компании' })
  @IsString()
  @IsNotEmpty()
  position: string;
}