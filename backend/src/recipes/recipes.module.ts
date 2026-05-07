import { Module } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { RecipesController } from './recipes.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { DataModule } from '../data/data.module';

@Module({
  imports: [PrismaModule, DataModule],
  controllers: [RecipesController],
  providers: [RecipesService],
})
export class RecipesModule {}
