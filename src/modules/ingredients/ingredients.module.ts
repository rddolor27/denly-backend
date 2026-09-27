import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngredientsController } from './controllers/ingredients.controller.js';
import { IngredientAlias } from './entities/ingredient-alias.entity.js';
import { Ingredient } from './entities/ingredient.entity.js';
import { IngredientsProvider } from './services/ingredients.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Ingredient, IngredientAlias])],
  controllers: [IngredientsController],
  providers: [IngredientsProvider],
  exports: [IngredientsProvider],
})
export class IngredientsModule {}
