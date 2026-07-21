import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminService } from './admin.service';
import { ApproveAgentDto } from './dto/approve-agent.dto';
import { RejectAgentDto } from './dto/reject-agent.dto';

@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('regions')
  findRegions(@CurrentUser() user: AuthenticatedUser) {
    return this.adminService.findRegions(user);
  }

  @Get('agents/pending')
  findPendingAgents(@CurrentUser() user: AuthenticatedUser) {
    return this.adminService.findPendingAgents(user);
  }

  @Post('agents/:id/approve')
  approveAgent(
    @Param('id') id: string,
    @Body() dto: ApproveAgentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.approveAgent(id, dto, user);
  }

  @Post('agents/:id/reject')
  rejectAgent(
    @Param('id') id: string,
    @Body() dto: RejectAgentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.rejectAgent(id, dto, user);
  }
}
