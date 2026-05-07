import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { CreateStepDto } from './dto/create-step.dto';
import { UpdateStepDto } from './dto/update-step.dto';
import { AddRecipeIngredientDto } from './dto/add-recipe-ingredient.dto';
import { AddRecipeTagDto } from './dto/add-recipe-tag.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { UpdateRecipePhotoDto } from './dto/update-recipe-photo.dto';
import { GetRecommendationsResponseDto } from './dto/get-recommendations-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateRecipeCommentDto } from './dto/create-recipe-comment.dto';
import { UpdateRecipeCommentDto } from './dto/update-recipe-comment.dto';
import { UpsertCommentReactionDto } from './dto/upsert-comment-reaction.dto';

@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) { }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body() createRecipeDto: CreateRecipeDto,
  ) {
    return this.recipesService.create(req.user.userID, createRecipeDto);
  }

  @Get()
  findAll() {
    return this.recipesService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  findMine(
    @Req() req: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.recipesService.findMine(req.user.userID, page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Get('feed')
  findFeed(@Req() req: AuthenticatedRequest) {
    return this.recipesService.findFeed(req.user.userID);
  }

  @UseGuards(JwtAuthGuard)
  @Get('recommendations')
  getRecommendations(
    @Req() req: AuthenticatedRequest,
  ): Promise<GetRecommendationsResponseDto> {
    return this.recipesService.getRecommendations(req.user.userID);
  }

  @Get('seed/:seedIndex')
  findSeedRecipe(@Param('seedIndex', ParseIntPipe) seedIndex: number) {
    return this.recipesService.findSeedRecipe(seedIndex);
  }

  @UseGuards(JwtAuthGuard)
  @Post('seed/:seedIndex/save')
  async saveSeedRecipe(
    @Req() req: AuthenticatedRequest,
    @Param('seedIndex', ParseIntPipe) seedIndex: number,
  ) {
    return this.recipesService.saveSeedRecipe(req.user.userID, seedIndex);
  }

  @Get(':recipeID')
  findOne(@Param('recipeID', ParseIntPipe) recipeID: number) {
    return this.recipesService.findOne(recipeID);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':recipeID/photo')
  updateRecipePhoto(
    @Req() req: AuthenticatedRequest,
    @Param('recipeID', ParseIntPipe) recipeID: number,
    @Body() dto: UpdateRecipePhotoDto,
  ) {
    return this.recipesService.updateRecipePhoto(
      req.user.userID,
      recipeID,
      dto.photo,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':recipeID')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('recipeID', ParseIntPipe) recipeID: number,
    @Body() updateRecipeDto: UpdateRecipeDto,
  ) {
    return this.recipesService.update(
      req.user.userID,
      recipeID,
      updateRecipeDto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':recipeID')
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('recipeID', ParseIntPipe) recipeID: number,
  ) {
    return this.recipesService.remove(req.user.userID, recipeID);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':recipeID/steps')
  addStep(
    @Req() req: AuthenticatedRequest,
    @Param('recipeID', ParseIntPipe) recipeID: number,
    @Body() createStepDto: CreateStepDto,
  ) {
    return this.recipesService.addStep(
      req.user.userID,
      recipeID,
      createStepDto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('steps/:stepID')
  updateStep(
    @Req() req: AuthenticatedRequest,
    @Param('stepID', ParseIntPipe) stepID: number,
    @Body() updateStepDto: UpdateStepDto,
  ) {
    return this.recipesService.updateStep(
      req.user.userID,
      stepID,
      updateStepDto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('steps/:stepID')
  removeStep(
    @Req() req: AuthenticatedRequest,
    @Param('stepID', ParseIntPipe) stepID: number,
  ) {
    return this.recipesService.removeStep(req.user.userID, stepID);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':recipeID/ingredients')
  addIngredient(
    @Req() req: AuthenticatedRequest,
    @Param('recipeID', ParseIntPipe) recipeID: number,
    @Body() dto: AddRecipeIngredientDto,
  ) {
    return this.recipesService.addIngredient(req.user.userID, recipeID, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':recipeID/ingredients/:ingredientID')
  removeIngredient(
    @Req() req: AuthenticatedRequest,
    @Param('recipeID', ParseIntPipe) recipeID: number,
    @Param('ingredientID', ParseIntPipe) ingredientID: number,
  ) {
    return this.recipesService.removeIngredient(
      req.user.userID,
      recipeID,
      ingredientID,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':recipeID/tags')
  addTag(
    @Req() req: AuthenticatedRequest,
    @Param('recipeID', ParseIntPipe) recipeID: number,
    @Body() dto: AddRecipeTagDto,
  ) {
    return this.recipesService.addTag(req.user.userID, recipeID, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':recipeID/tags/:tagID')
  removeTag(
    @Req() req: AuthenticatedRequest,
    @Param('recipeID', ParseIntPipe) recipeID: number,
    @Param('tagID', ParseIntPipe) tagID: number,
  ) {
    return this.recipesService.removeTag(req.user.userID, recipeID, tagID);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':recipeID/reviews')
  addReview(
    @Req() req: AuthenticatedRequest,
    @Param('recipeID', ParseIntPipe) recipeID: number,
    @Body() createReviewDto: CreateReviewDto,
  ) {
    return this.recipesService.addReview(
      req.user.userID,
      recipeID,
      createReviewDto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('reviews/:reviewID')
  updateReview(
    @Req() req: AuthenticatedRequest,
    @Param('reviewID', ParseIntPipe) reviewID: number,
    @Body() updateReviewDto: UpdateReviewDto,
  ) {
    return this.recipesService.updateReview(
      req.user.userID,
      reviewID,
      updateReviewDto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('reviews/:reviewID')
  removeReview(
    @Req() req: AuthenticatedRequest,
    @Param('reviewID', ParseIntPipe) reviewID: number,
  ) {
    return this.recipesService.removeReview(req.user.userID, reviewID);
  }

  @Get(':recipeID/comments')
  findComments(@Param('recipeID', ParseIntPipe) recipeID: number) {
    return this.recipesService.findComments(recipeID);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':recipeID/comments')
  addComment(
    @Req() req: AuthenticatedRequest,
    @Param('recipeID', ParseIntPipe) recipeID: number,
    @Body() dto: CreateRecipeCommentDto,
  ) {
    return this.recipesService.addComment(req.user.userID, recipeID, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('comments/:commentID')
  updateComment(
    @Req() req: AuthenticatedRequest,
    @Param('commentID', ParseIntPipe) commentID: number,
    @Body() dto: UpdateRecipeCommentDto,
  ) {
    return this.recipesService.updateComment(req.user.userID, commentID, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('comments/:commentID')
  removeComment(
    @Req() req: AuthenticatedRequest,
    @Param('commentID', ParseIntPipe) commentID: number,
  ) {
    return this.recipesService.removeComment(req.user.userID, commentID);
  }

  @UseGuards(JwtAuthGuard)
  @Post('comments/:commentID/reaction')
  upsertCommentReaction(
    @Req() req: AuthenticatedRequest,
    @Param('commentID', ParseIntPipe) commentID: number,
    @Body() dto: UpsertCommentReactionDto,
  ) {
    return this.recipesService.upsertCommentReaction(
      req.user.userID,
      commentID,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('comments/:commentID/reaction')
  removeCommentReaction(
    @Req() req: AuthenticatedRequest,
    @Param('commentID', ParseIntPipe) commentID: number,
  ) {
    return this.recipesService.removeCommentReaction(
      req.user.userID,
      commentID,
    );
  }
}
