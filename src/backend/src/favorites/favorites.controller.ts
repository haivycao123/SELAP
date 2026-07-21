import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';

@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  // POST /favorites/:propertyId
  @Post(':propertyId')
  addFavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseIntPipe) propertyId: number,
  ) {
    return this.favoritesService.addFavorite(user.id, propertyId);
  }

  // DELETE /favorites/:propertyId
  @Delete(':propertyId')
  removeFavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('propertyId', ParseIntPipe) propertyId: number,
  ) {
    return this.favoritesService.removeFavorite(user.id, propertyId);
  }

  // GET /favorites
  @Get()
  getUserFavorites(@CurrentUser() user: AuthenticatedUser) {
    return this.favoritesService.getUserFavorites(user.id);
  }
}