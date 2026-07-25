import {
  Controller,
  Post,
  Get,
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

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  // POST /leads (Customer gửi Request Consultation)
  @Post()
  createLead(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLeadDto,
  ) {
    return this.leadsService.createLead(user.id, dto);
  }

  // POST /leads/:id/claim (Sales Agent bấm Claim Lead)
  @Post(':id/claim')
  claimLead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) leadId: number,
  ) {
    return this.leadsService.claimLead(user.id, leadId);
  }

  // GET /leads/available (Sales Agent lấy danh sách Lead PENDING thuộc vùng của mình)
  @Get('available')
  getAvailableLeads(@CurrentUser() user: AuthenticatedUser) {
    return this.leadsService.getAvailableLeadsForAgent(user.id);
  }
}