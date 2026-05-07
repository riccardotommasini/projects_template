import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RecipesModule } from './recipes/recipes.module';
import { IngredientsModule } from './ingredients/ingredients.module';
import { ShoppingListsModule } from './shopping-lists/shopping-lists.module';
import { GroupsModule } from './groups/groups.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { TagsModule } from './tags/tags.module';
import { AuthModule } from './auth/auth.module';
import { TranscriptionModule } from './transcription/transcription.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    RecipesModule,
    IngredientsModule,
    ShoppingListsModule,
    GroupsModule,
    UsersModule,
    TagsModule,
    AuthModule,
    TranscriptionModule,
  ],
})
export class AppModule {}
