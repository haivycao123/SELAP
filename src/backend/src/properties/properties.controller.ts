import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertyFilterDto } from './dto/property-filter.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertiesService } from './properties.service';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  findPublic(@Query() filters: PropertyFilterDto) {
    return this.propertiesService.findPublic(filters);
  }

  @UseGuards(JwtAuthGuard)
  @Get('manage')
  findForManagement(
    @Query() filters: PropertyFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertiesService.findForManagement(filters, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('manage/:id')
  findManageById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertiesService.findManageById(id, user);
  }

  @Get(':id')
  findPublicById(@Param('id') id: string) {
    return this.propertiesService.findPublicById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() dto: CreatePropertyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertiesService.create(dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertiesService.update(id, dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.propertiesService.remove(id, user);
  }
}
