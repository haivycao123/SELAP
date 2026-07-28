import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountStatus,
  NotificationType,
  Prisma,
  Role,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { ApproveAgentDto } from './dto/approve-agent.dto';
import { RejectAgentDto } from './dto/reject-agent.dto';

const pendingAgentInclude = {
  agentProfile: {
    include: {
      regions: {
        include: { region: true },
        orderBy: { assignedAt: 'desc' as const },
      },
    },
  },
} satisfies Prisma.UserInclude;

const staffInclude = {
  _count: {
    select: {
      assignedLeads: true,
      createdProperties: true,
    },
  },
  agentProfile: {
    include: {
      regions: {
        include: { region: true },
        orderBy: { assignedAt: 'desc' as const },
      },
    },
  },
  approvedBy: {
    select: {
      id: true,
      name: true,
    },
  },
  rejectedBy: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.UserInclude;

const defaultRegions = [
  { code: 'TAN_BINH', name: 'Tan Binh', city: 'Ho Chi Minh City', district: 'Tan Binh' },
  { code: 'PHU_NHUAN', name: 'Phu Nhuan', city: 'Ho Chi Minh City', district: 'Phu Nhuan' },
  { code: 'TAN_PHU', name: 'Tan Phu', city: 'Ho Chi Minh City', district: 'Tan Phu' },
  { code: 'THU_DUC', name: 'Thu Duc', city: 'Ho Chi Minh City', district: 'Thu Duc' },
];

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async findRegions(user: AuthenticatedUser) {
    this.assertAdmin(user);
    await this.ensureDefaultRegions();

    const regions = await this.prisma.region.findMany({
      orderBy: [{ city: 'asc' }, { district: 'asc' }, { name: 'asc' }],
    });

    return { data: regions };
  }

  async findPendingAgents(user: AuthenticatedUser) {
    this.assertAdmin(user);

    const agents = await this.prisma.user.findMany({
      where: {
        role: Role.SALES_AGENT,
        status: AccountStatus.PENDING,
      },
      include: pendingAgentInclude,
      orderBy: { createdAt: 'asc' },
    });

    return { data: agents.map((agent) => this.toAgentResponse(agent)) };
  }

  async findStaff(user: AuthenticatedUser) {
    this.assertAdmin(user);

    const staff = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.ADMIN, Role.SALES_AGENT] },
      },
      include: staffInclude,
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    });

    return { data: staff.map((member) => this.toStaffResponse(member)) };
  }

  async approveAgent(
    rawId: string,
    dto: ApproveAgentDto,
    admin: AuthenticatedUser,
  ) {
    this.assertAdmin(admin);
    await this.ensureDefaultRegions();
    const agentId = this.parseId(rawId, 'Agent id');
    const regionIds = this.parseRegionIds(dto.regionIds);

    const agent = await this.findPendingSalesAgent(agentId);
    const regions = await this.prisma.region.findMany({
      where: { id: { in: regionIds } },
    });

    if (regions.length !== regionIds.length) {
      throw new BadRequestException('One or more selected regions do not exist.');
    }

    const updatedAgent = await this.prisma.$transaction(async (tx) => {
      const profile =
        agent.agentProfile ??
        (await tx.agentProfile.create({
          data: { userId: agent.id },
        }));

      await tx.agentRegion.deleteMany({
        where: { agentProfileId: profile.id },
      });

      await tx.agentRegion.createMany({
        data: regionIds.map((regionId) => ({
          agentProfileId: profile.id,
          regionId,
        })),
      });

      await tx.notification.create({
        data: {
          userId: agent.id,
          senderId: admin.id,
          type: NotificationType.ACCOUNT_APPROVED,
          title: 'Account approved',
          message: 'Your Sales Agent account has been approved and assigned to an area.',
          data: { regionIds },
        },
      });

      return tx.user.update({
        where: { id: agent.id },
        data: {
          status: AccountStatus.ACTIVE,
          approvedAt: new Date(),
          approvedById: admin.id,
          rejectedAt: null,
          rejectedById: null,
          rejectReason: null,
        },
        include: pendingAgentInclude,
      });
    });

    return {
      message: 'Sales Agent approved successfully.',
      agent: this.toAgentResponse(updatedAgent),
    };
  }

  async rejectAgent(
    rawId: string,
    dto: RejectAgentDto,
    admin: AuthenticatedUser,
  ) {
    this.assertAdmin(admin);
    const agentId = this.parseId(rawId, 'Agent id');
    const reason = this.parseRejectReason(dto.reason);
    const agent = await this.findPendingSalesAgent(agentId);

    const updatedAgent = await this.prisma.$transaction(async (tx) => {
      await tx.notification.create({
        data: {
          userId: agent.id,
          senderId: admin.id,
          type: NotificationType.ACCOUNT_REJECTED,
          title: 'Account rejected',
          message: reason
            ? `Your Sales Agent account was rejected: ${reason}`
            : 'Your Sales Agent account was rejected.',
          data: reason ? { reason } : undefined,
        },
      });

      return tx.user.update({
        where: { id: agent.id },
        data: {
          status: AccountStatus.REJECTED,
          rejectedAt: new Date(),
          rejectedById: admin.id,
          rejectReason: reason,
          approvedAt: null,
          approvedById: null,
        },
        include: pendingAgentInclude,
      });
    });

    return {
      message: 'Sales Agent rejected successfully.',
      agent: this.toAgentResponse(updatedAgent),
    };
  }

  private async findPendingSalesAgent(id: number) {
    const agent = await this.prisma.user.findUnique({
      where: { id },
      include: pendingAgentInclude,
    });

    if (!agent || agent.role !== Role.SALES_AGENT) {
      throw new NotFoundException('Pending Sales Agent not found.');
    }

    if (agent.status !== AccountStatus.PENDING) {
      throw new BadRequestException('Only pending Sales Agent accounts can be reviewed.');
    }

    return agent;
  }

  private toAgentResponse(
    agent: Prisma.UserGetPayload<{ include: typeof pendingAgentInclude }>,
  ) {
    return {
      id: agent.id,
      name: agent.name,
      email: agent.email,
      phone: agent.phone,
      role: agent.role,
      status: agent.status,
      createdAt: agent.createdAt,
      approvedAt: agent.approvedAt,
      rejectedAt: agent.rejectedAt,
      rejectReason: agent.rejectReason,
      regions:
        agent.agentProfile?.regions.map((assignment) => ({
          id: assignment.region.id,
          name: assignment.region.name,
          code: assignment.region.code,
          city: assignment.region.city,
          district: assignment.region.district,
          ward: assignment.region.ward,
          assignedAt: assignment.assignedAt,
        })) ?? [],
    };
  }

  private toStaffResponse(
    member: Prisma.UserGetPayload<{ include: typeof staffInclude }>,
  ) {
    return {
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      role: member.role,
      status: member.status,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      approvedAt: member.approvedAt,
      rejectedAt: member.rejectedAt,
      rejectReason: member.rejectReason,
      approvedBy: member.approvedBy
        ? {
            id: member.approvedBy.id,
            name: member.approvedBy.name,
          }
        : null,
      rejectedBy: member.rejectedBy
        ? {
            id: member.rejectedBy.id,
            name: member.rejectedBy.name,
          }
        : null,
      regions:
        member.agentProfile?.regions.map((assignment) => ({
          id: assignment.region.id,
          name: assignment.region.name,
          code: assignment.region.code,
          city: assignment.region.city,
          district: assignment.region.district,
          ward: assignment.region.ward,
          assignedAt: assignment.assignedAt,
        })) ?? [],
      stats: {
        assignedLeads: member._count.assignedLeads,
        createdProperties: member._count.createdProperties,
      },
    };
  }

  private parseId(value: string, label: string) {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException(`${label} must be a positive integer.`);
    }

    return id;
  }

  private parseRegionIds(value: unknown) {
    if (!Array.isArray(value) || value.length === 0) {
      throw new BadRequestException('At least one area must be selected before approving.');
    }

    const ids = [...new Set(value.map((item) => Number(item)))];

    if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
      throw new BadRequestException('Region ids must be positive integers.');
    }

    return ids;
  }

  private parseRejectReason(value: unknown) {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException('Reject reason must be text.');
    }

    const reason = value.trim();

    if (reason.length > 500) {
      throw new BadRequestException('Reject reason must be 500 characters or fewer.');
    }

    return reason || null;
  }

  private assertAdmin(user: AuthenticatedUser) {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('Only Admin users can review Sales Agent accounts.');
    }
  }

  private async ensureDefaultRegions() {
    await this.prisma.$transaction(
      defaultRegions.map((region) =>
        this.prisma.region.upsert({
          where: { code: region.code },
          update: {},
          create: region,
        }),
      ),
    );
  }
}
