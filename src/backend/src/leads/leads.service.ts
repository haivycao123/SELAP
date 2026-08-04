import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  Prisma,
  AccountStatus,
  LeadStatus,
  LeadSource,
  PropertyStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimingGateway } from '../claiming/claiming.gateway';
import { CreateLeadDto } from './dto/create-lead.dto';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly claimingGateway: ClaimingGateway,
  ) {}

  async createLead(customerId: number, dto: CreateLeadDto) {
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
    });

    if (!customer) throw new NotFoundException('Customer not found.');

    const property = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
    });

    if (!property) throw new NotFoundException('Property not found.');

    if (
      property.status === PropertyStatus.DEPOSITED ||
      property.status === PropertyStatus.SOLD
    ) {
      throw new BadRequestException('Property is no longer available.');
    }

    const existingActiveLead = await this.prisma.lead.findFirst({
      where: {
        customerId,
        propertyId: dto.propertyId,
        status: LeadStatus.NEW,
      },
    });

    if (existingActiveLead) {
      throw new BadRequestException(
        'You already have a pending consultation request for this property. Please wait for an agent to accept it.',
      );
    }

    const lead = await this.prisma.lead.create({
      data: {
        customerId,
        customerName: customer.name,
        customerPhone: customer.phone,
        propertyId: dto.propertyId,
        regionId: property.regionId,
        message: dto.note,
        source: LeadSource.CONSULTATION_REQUEST,
        status: LeadStatus.NEW,
      },
      include: { property: true },
    });

    if (property.regionId) {
      this.claimingGateway.broadcastNewLead(property.regionId, lead);
    }

    return { message: 'Consultation request sent.', lead };
  }

  async claimLead(agentUserId: number, leadId: number) {
    const agentUser = await this.prisma.user.findUnique({
      where: { id: agentUserId },
      include: { agentProfile: { include: { regions: true } } },
    });

    if (!agentUser || agentUser.status !== AccountStatus.ACTIVE || !agentUser.agentProfile) {
      throw new ForbiddenException('Only active Sales Agents can claim leads.');
    }

    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });

    if (!lead) throw new NotFoundException('Lead not found.');
    if (lead.status !== LeadStatus.NEW) {
      throw new ConflictException('This lead has already been claimed!');
    }

    if (lead.regionId) {
      const isAssigned = agentUser.agentProfile.regions.some(
        (r) => r.regionId === lead.regionId,
      );
      if (!isAssigned) {
        throw new ForbiddenException('You are not assigned to this region.');
      }
    }

    try {
      const updatedLead = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.lead.update({
          where: { id: leadId, status: LeadStatus.NEW },
          data: {
            assignedAgentId: agentUserId,
            status: LeadStatus.CLAIMED,
            claimedAt: new Date(),
          },
          include: {
            customer: { select: { id: true, name: true, phone: true, email: true } },
            property: true,
          },
        });

        await tx.leadClaim.create({
          data: { leadId, agentId: agentUserId },
        });

        return updated;
      });

      if (updatedLead.customerId) {
        const propertyTitle = updatedLead.property?.title || 'Property';
        const notificationTitle = 'Consultation Request Accepted';
        const notificationMessage = `Your consultation request for ${propertyTitle} has been accepted by ${agentUser.name}. They will contact you shortly.`;

        // Lưu thông báo vào Database để hiển thị trong tab Notifications
        await this.prisma.notification.create({
          data: {
            userId: updatedLead.customerId,
            type: 'LEAD_ACCEPTED',
            title: notificationTitle,
            message: notificationMessage,
            data: {
              leadId: updatedLead.id,
              propertyId: updatedLead.propertyId,
            },
          },
        });

        // Phát WebSocket Real-time cho Customer
        this.claimingGateway.notifyCustomerLeadAccepted(updatedLead.customerId, {
          leadId: updatedLead.id,
          agentName: agentUser.name,
          propertyTitle: propertyTitle,
          message: notificationMessage,
        });
      }

      if (updatedLead.regionId) {
        this.claimingGateway.broadcastLeadClaimed(updatedLead.regionId, {
          leadId: updatedLead.id,
          claimedByAgentId: agentUserId,
        });
      }

      return {
        message: 'Lead claimed successfully!',
        customerContact: {
          name: updatedLead.customerName,
          phone: updatedLead.customerPhone,
          email: updatedLead.customer?.email,
        },
        lead: updatedLead,
      };
    } catch (error) {
      throw new ConflictException('This request was accepted by another Sales Agent.');
    }
  }

  async getAvailableLeadsForAgent(agentUserId: number) {
    const agentProfile = await this.prisma.agentProfile.findUnique({
      where: { userId: agentUserId },
      include: { regions: true },
    });

    if (!agentProfile) throw new ForbiddenException('Only Sales Agents can view available leads.');

    const assignedRegionIds = agentProfile.regions.map((r) => r.regionId);

    const leads = await this.prisma.lead.findMany({
      where: {
        regionId: { in: assignedRegionIds },
        status: LeadStatus.NEW,
      },
      include: { property: true },
      orderBy: { createdAt: 'desc' },
    });

    return leads.map((lead) => ({
      ...lead,
      customerName: 'New Consultation Request',
      customerPhone: 'Hidden (Claim to view)',
    }));
  }

  // Lấy danh sách Lead đã được gán cho Agent
  async getAssignedLeadsForAgent(agentUserId: number) {
    return this.prisma.lead.findMany({
      where: {
        assignedAgentId: agentUserId,
      },
      include: {
        property: true,
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // Cập nhật trạng thái xử lý Lead
  async updateLeadStatus(
    agentUserId: number,
    leadId: number,
    status: LeadStatus,
  ) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });

    if (!lead) throw new NotFoundException('Lead not found.');
    if (lead.assignedAgentId !== agentUserId) {
      throw new ForbiddenException('You can only update leads assigned to you.');
    }

    return this.prisma.lead.update({
      where: { id: leadId },
      data: {
        status,
        updatedAt: new Date(),
        ...(status === LeadStatus.CONTACTED ? { contactedAt: new Date() } : {}),
      },
      include: { property: true },
    });
  }
}