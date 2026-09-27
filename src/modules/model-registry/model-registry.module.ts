import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelRegistryController } from './controllers/model-registry.controller.js';
import { ModelClass } from './entities/model-class.entity.js';
import { ModelVersion } from './entities/model-version.entity.js';
import { ModelRegistryProvider } from './services/model-registry.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([ModelVersion, ModelClass])],
  controllers: [ModelRegistryController],
  providers: [ModelRegistryProvider],
  exports: [ModelRegistryProvider],
})
export class ModelRegistryModule {}
