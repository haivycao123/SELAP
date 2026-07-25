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

  // Request for Consultation (Khách hàng tạo yêu cầu tư vấn)
  async createLead(customerId: number, dto: CreateLeadDto) {
    // 1. Lấy thông tin Customer
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    // 2. Kiểm tra tồn tại và trạng thái căn hộ (Pre-condition UC010)
    const property = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
      include: { region: true },
    });

    if (!property) {
      throw new NotFoundException('Property not found.');
    }

    // Căn hộ không khả dụng
    if (
      property.status === PropertyStatus.DEPOSITED ||
      property.status === PropertyStatus.SOLD
    ) {
      throw new BadRequestException(
        'This property is no longer available for consultation.',
      );
    }

    // Khách hàng đã gửi yêu cầu tư vấn NEW cho căn hộ này trước đó
    const existingNewLead = await this.prisma.lead.findFirst({
      where: {
        customerId,
        propertyId: dto.propertyId,
        status: LeadStatus.NEW,
      },
    });

    if (existingNewLead) {
      throw new BadRequestException(
        'You have already submitted a consultation request for this property. Please wait for an agent to respond.',
      );
    }

    // 3. Tạo Lead mới trong DB
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
      include: {
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
        property: true,
      },
    });

    // 4. Broadcast event 'new_lead' qua Socket tới các Sales Agent thuộc Region
    if (property.regionId) {
      this.claimingGateway.broadcastNewLead(property.regionId, {
        id: lead.id,
        propertyTitle: property.title,
        address: `${property.address}, ${property.district}, ${property.city}`,
        timestamp: lead.createdAt,
        regionId: property.regionId,
      });
    }

    return {
      message:
        'Your consultation request has been sent successfully. You will be notified when an agent accepts your request.',
      lead,
    };
  }

  // Claim Lead (Sales Agent giành Lead)
  async claimLead(agentUserId: number, leadId: number) {
    // 1. Kiểm tra tài khoản Sales Agent
    const agentUser = await this.prisma.user.findUnique({
      where: { id: agentUserId },
      include: {
        agentProfile: {
          include: {
            regions: true,
          },
        },
      },
    });

    if (
      !agentUser ||
      agentUser.status !== AccountStatus.ACTIVE ||
      !agentUser.agentProfile
    ) {
      throw new ForbiddenException(
        'Only active Sales Agents can claim consultation requests.',
      );
    }

    // 2. Lấy thông tin Lead
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      throw new NotFoundException('Consultation request not found.');
    }

    // Lead không còn khả dụng (Status không phải NEW)
    if (lead.status !== LeadStatus.NEW) {
      throw new ConflictException(
        'This request is no longer available for claiming.',
      );
    }

    // 3. Kiểm tra Agent có được phân công Region của Lead hay không
    if (lead.regionId) {
      const isAssignedToRegion = agentUser.agentProfile.regions.some(
        (r) => r.regionId === lead.regionId,
      );

      if (!isAssignedToRegion) {
        throw new ForbiddenException(
          'You are not assigned to the geographical area of this lead.',
        );
      }
    }

    // 4. Atomic Lock & Transaction chống race condition
    try {
      const updatedLead = await this.prisma.$transaction(async (tx) => {
        // Cập nhật Lead chỉ khi status vẫn là NEW
        const updated = await tx.lead.update({
          where: {
            id: leadId,
            status: LeadStatus.NEW,
          },
          data: {
            assignedAgentId: agentUserId,
            status: LeadStatus.CLAIMED,
            claimedAt: new Date(),
          },
          include: {
            customer: {
              select: { id: true, name: true, phone: true, email: true },
            },
            property: true,
          },
        });

        // Ghi nhận log tranh chấp / giành lead vào bảng LeadClaim
        await tx.leadClaim.create({
          data: {
            leadId,
            agentId: agentUserId,
          },
        });

        return updated;
      });

      // Bắn Socket thông báo cho Customer là yêu cầu đã được tiếp nhận
      if (updatedLead.customerId) {
        this.claimingGateway.notifyCustomerLeadAccepted(
          updatedLead.customerId,
          {
            leadId: updatedLead.id,
            propertyTitle: updatedLead.property?.title,
            agentName: agentUser.name,
            message:
              'Your consultation request has been accepted by an agent.',
          },
        );
      }

      return {
        message:
          'Lead claimed successfully! Customer contact information is now available.',
        customerContact: {
          name: updatedLead.customerName,
          phone: updatedLead.customerPhone,
          email: updatedLead.customer?.email,
        },
        lead: updatedLead,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2025' || error.code === 'P2002')
      ) {
        // Alt Scenario 4a: Đã có Agent khác giành trước thành công
        throw new ConflictException(
          'This request has already been claimed by another agent!',
        );
      }
      throw error;
    }
  }

  // Lấy danh sách Lead NEW trong các Region mà Agent quản lý
  async getAvailableLeadsForAgent(agentUserId: number) {
    const agentProfile = await this.prisma.agentProfile.findUnique({
      where: { userId: agentUserId },
      include: { regions: true },
    });

    if (!agentProfile) {
      throw new ForbiddenException(
        'Only Sales Agents can view available leads.',
      );
    }

    const assignedRegionIds = agentProfile.regions.map((r) => r.regionId);

    return this.prisma.lead.findMany({
      where: {
        regionId: { in: assignedRegionIds },
        status: LeadStatus.NEW,
      },
      include: {
        property: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}