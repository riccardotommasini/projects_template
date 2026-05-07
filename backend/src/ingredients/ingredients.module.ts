import { Module } from '@nestjs/common';
import { RecipesService } from '../recipes/recipes.service';
import { RecipesController } from '../recipes/recipes.controller';
import { IngredientsSearchController } from './ingredients.search.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { DataModule } from '../data/data.module';

@Module({
  imports: [PrismaModule, DataModule],
  controllers: [RecipesController, IngredientsSearchController],
  providers: [RecipesService],
})
export class IngredientsModule {}

