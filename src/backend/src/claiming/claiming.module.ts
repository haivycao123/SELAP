import { Module } from '@nestjs/common';
import { ClaimingGateway } from './claiming.gateway';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AuthModule, PrismaModule],
  providers: [ClaimingGateway],
  exports: [ClaimingGateway],
})
export class ClaimingModule {}