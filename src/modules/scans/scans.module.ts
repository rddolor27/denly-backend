import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngredientIntelligenceModule } from '@/modules/ingredient-intelligence/ingredient-intelligence.module.js';
import { ModelRegistryModule } from '@/modules/model-registry/model-registry.module.js';
import { ScansController } from './controllers/scans.controller.js';
import { Detection } from './entities/detection.entity.js';
import { Scan } from './entities/scan.entity.js';
import { ScansProvider } from './services/scans.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Scan, Detection]),
    ModelRegistryModule,
    IngredientIntelligenceModule,
  ],
  controllers: [ScansController],
  providers: [ScansProvider],
})
export class ScansModule {}
