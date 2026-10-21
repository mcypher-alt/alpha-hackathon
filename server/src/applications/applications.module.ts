import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller.js';
import { MlMockService } from './ml-mock.service.js';

@Module({
  controllers: [ApplicationsController],
  providers: [MlMockService],
})
export class ApplicationsModule {}