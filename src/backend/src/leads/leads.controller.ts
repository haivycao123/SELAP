import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { LeadStatus } from '@prisma/client';

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  createLead(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLeadDto,
  ) {
    return this.leadsService.createLead(user.id, dto);
  }

  @Get('available')
  getAvailableLeads(@CurrentUser() user: AuthenticatedUser) {
    return this.leadsService.getAvailableLeadsForAgent(user.id);
  }

  @Get('assigned')
  getAssignedLeads(@CurrentUser() user: AuthenticatedUser) {
    return this.leadsService.getAssignedLeadsForAgent(user.id);
  }

  @Post(':id/claim')
  claimLead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) leadId: number,
  ) {
    return this.leadsService.claimLead(user.id, leadId);
  }

  @Patch(':id/status')
  updateLeadStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) leadId: number,
    @Body('status') status: LeadStatus,
  ) {
    return this.leadsService.updateLeadStatus(user.id, leadId, status);
  }
}
