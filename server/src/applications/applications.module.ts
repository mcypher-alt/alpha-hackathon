import { Module } from '@nestjs/common';
import {
  ApplicationsController,
  ProductsController,
} from './applications.controller.js';
import { MlMockService } from './ml-mock.service.js';

@Module({
  controllers: [ApplicationsController, ProductsController],
  providers: [MlMockService],
})
export class ApplicationsModule {}
