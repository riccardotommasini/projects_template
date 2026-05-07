import { Module } from '@nestjs/common';
import { SeedRecipesService } from './seed-recipes.service';

@Module({
  providers: [SeedRecipesService],
  exports: [SeedRecipesService],
})
export class DataModule {}
