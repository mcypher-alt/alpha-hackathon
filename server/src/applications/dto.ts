import { Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '@prisma/client';

export class CreateApplicationDto {
  @ApiProperty({ example: '7714892011' })
  @Matches(/^\d{10}(\d{2})?$/)
  inn: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{13}(\d{2})?$/)
  ogrn?: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(200) companyName: string;
  @ApiPropertyOptional({ enum: ['ООО', 'ИП'] })
  @IsOptional()
  @IsIn(['ООО', 'ИП'])
  legalForm?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{2}(\.\d{1,2}){0,2}$/)
  okved?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  okvedTitle?: string;
  @ApiProperty({ example: '2022-03-15' })
  @IsDateString()
  registrationDate: string;
  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(1e12)
  monthlyRevenue: number;
  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1e12)
  monthlyExpenses: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1e12)
  currentDebtLoad?: number;
  @ApiProperty({
    enum: [
      'K1',
      'K2',
      'L1',
      'L2',
      'L3',
      'O1',
      'A1',
      'M1',
      'C1',
      'T1',
      'N1',
      'R1',
      'R2',
    ],
  })
  @IsIn([
    'K1',
    'K2',
    'L1',
    'L2',
    'L3',
    'O1',
    'A1',
    'M1',
    'C1',
    'T1',
    'N1',
    'R1',
    'R2',
  ])
  productCode: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  productName?: string;
  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(150000000)
  requestedAmount: number;
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(180)
  requestedTermMonths: number;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(2000) purpose: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn([
    'operations',
    'gap',
    'equipment',
    'auto',
    'property',
    'refi',
    'market',
    'other',
  ])
  purposeCode?: string;
  @ApiPropertyOptional({
    type: Object,
    description: 'Ответы адаптивного опроса, string values',
  })
  @IsOptional()
  @IsObject()
  answers?: Record<string, string>;
  @ApiProperty({
    example: true,
    description: 'Согласие на обработку синтетических данных',
  })
  @IsBoolean()
  @Equals(true)
  consent: boolean;
}
export class VersionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  expectedVersion?: number;
  @ApiPropertyOptional({ enum: ApplicationStatus })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  expectedStatus?: ApplicationStatus;
}
export class InterveneDto extends VersionDto {
  @ApiProperty({
    enum: [
      'APPROVED',
      'REJECTED',
      'NEED_INFO',
      'COUNTER_OFFER',
      'MANUAL_REVIEW',
    ],
  })
  @IsIn(['APPROVED', 'REJECTED', 'NEED_INFO', 'COUNTER_OFFER', 'MANUAL_REVIEW'])
  toStatus: ApplicationStatus;
  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  decisionNote: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(150000000)
  approvedAmount?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  approvedTermMonths?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(60)
  approvedRate?: number;
}
export class ClientActionDto extends VersionDto {
  @ApiProperty({ enum: ['ACCEPT_OFFER', 'SIGN_CONTRACT', 'PROVIDE_INFO'] })
  @IsIn(['ACCEPT_OFFER', 'SIGN_CONTRACT', 'PROVIDE_INFO'])
  action: 'ACCEPT_OFFER' | 'SIGN_CONTRACT' | 'PROVIDE_INFO';
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  clientComment?: string;
}
export class DocumentDto {
  @ApiProperty({ enum: ['STATEMENT', 'BALANCE', 'OTHER'] })
  @IsIn(['STATEMENT', 'BALANCE', 'OTHER'])
  type: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(200) title: string;
  @ApiProperty({ description: 'Текст синтетического документа' })
  @IsString()
  @MinLength(10)
  @MaxLength(100000)
  content: string;
}
export class IntentDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(2000) text: string;
}
export class BankQueryDto {
  @IsOptional() @IsIn(['ALL', 'IN_PROGRESS', 'COMPLETED']) completion?:
    'ALL' | 'IN_PROGRESS' | 'COMPLETED';
  @IsOptional() @IsEnum(ApplicationStatus) status?: ApplicationStatus;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}
