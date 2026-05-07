import { SeedRecipe } from '../../data/seed-recipes.service';

export class GetRecommendationsResponseDto {
  recommendations: SeedRecipe[];
  preferencesCount: number;
}
