import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('API');
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) {
      const response = error.getResponse();
      res
        .status(error.getStatus())
        .json(
          typeof response === 'string'
            ? { statusCode: error.getStatus(), message: response }
            : response,
        );
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const status =
        error.code === 'P2025'
          ? 404
          : ['P2002', 'P2034'].includes(error.code)
            ? 409
            : 500;
      const message =
        status === 404
          ? 'Запись не найдена'
          : status === 409
            ? 'Данные уже изменились или запись существует'
            : 'Ошибка хранения данных';
      res.status(status).json({ statusCode: status, message });
      return;
    }
    this.logger.error(error instanceof Error ? error.message : 'Unknown error');
    res
      .status(500)
      .json({
        statusCode: 500,
        message: 'Внутренняя ошибка. Повторите запрос позже.',
      });
  }
}
