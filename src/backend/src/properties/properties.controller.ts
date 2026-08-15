import {
  Body,
  Controller,
  Delete,
  BadRequestException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertyFilterDto } from './dto/property-filter.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertiesService } from './properties.service';

const uploadDir = join(process.cwd(), 'uploads', 'properties');

function ensureUploadDir() {
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }
}

function imageFileFilter(
  _request: unknown,
  file: { mimetype?: string },
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!file.mimetype?.startsWith('image/')) {
    callback(new BadRequestException('Only image files are allowed.'), false);
    return;
  }

  callback(null, true);
}

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

  @UseGuards(JwtAuthGuard)
  @Get('regions/options')
  findRegionOptions(@CurrentUser() user: AuthenticatedUser) {
    return this.propertiesService.findRegionOptions(user);
  }

  @Get('regions/public-options')
  findPublicRegionOptions() {
    return this.propertiesService.findPublicRegionOptions();
  }

  @Get(':id')
  findPublicById(@Param('id') id: string) {
    return this.propertiesService.findPublicById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('uploads/images')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: imageFileFilter,
      storage: diskStorage({
        destination: (
          _request: unknown,
          _file: unknown,
          callback: (error: Error | null, destination: string) => void,
        ) => {
          ensureUploadDir();
          callback(null, uploadDir);
        },
        filename: (
          _request: unknown,
          file: { originalname?: string },
          callback: (error: Error | null, filename: string) => void,
        ) => {
          const extension = extname(file.originalname ?? '').toLowerCase();
          callback(null, `${randomUUID()}${extension}`);
        },
      }),
    }),
  )
  uploadImage(@UploadedFile() file: { filename?: string } | undefined) {
    if (!file?.filename) {
      throw new BadRequestException('Image file is required.');
    }

    const path = `/uploads/properties/${file.filename}`;
    const baseUrl = process.env.BACKEND_PUBLIC_URL ?? 'http://localhost:3001';

    return {
      message: 'Image uploaded successfully.',
      path,
      url: `${baseUrl}${path}`,
    };
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
