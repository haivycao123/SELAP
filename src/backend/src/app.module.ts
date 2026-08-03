import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { PropertiesModule } from './properties/properties.module';
import { AdminModule } from './admin/admin.module';
import { FavoritesModule } from './favorites/favorites.module';
import { NotificationsModule } from './notifications/notifications.module';
import { LeadsModule } from './leads/leads.module';
import { ClaimingModule } from './claiming/claiming.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    PropertiesModule,
    AdminModule,
    FavoritesModule,
    NotificationsModule,
    LeadsModule,
    ClaimingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
