import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FavoritesService } from './favorites.service';

@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.favoritesService.findAll(user);
  }

  @Post(':propertyId')
  create(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.favoritesService.create(propertyId, user);
  }

  @Delete(':propertyId')
  remove(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.favoritesService.remove(propertyId, user);
  }
}
