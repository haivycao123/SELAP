import { Module } from '@nestjs/common';
import { ClaimingGateway } from './claiming.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [ClaimingGateway],
  exports: [ClaimingGateway],
})
export class ClaimingModule {}