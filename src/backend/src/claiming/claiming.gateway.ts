import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { TokenService } from '../auth/token.service';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'claiming',
})
@Injectable()
export class ClaimingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ClaimingGateway.name);

  constructor(
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.tokenService.verifyAccessToken(token);
      client.data.user = payload;

      client.join(`user_${payload.sub}`);

      if (payload.role === 'SALES_AGENT') {
        const agentProfile = await this.prisma.agentProfile.findUnique({
          where: { userId: payload.sub },
          include: { regions: true },
        });

        if (agentProfile && agentProfile.regions.length > 0) {
          agentProfile.regions.forEach((r) => {
            const roomName = `region_${r.regionId}`;
            client.join(roomName);
            this.logger.log(`Agent ${payload.sub} joined room: ${roomName}`);
          });
        }
      }

      this.logger.log(`User ${payload.sub} connected on socket ${client.id}`);
    } catch (error: any) {
      this.logger.error(`Socket auth failed: ${error?.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinRegionRoom')
  handleJoinRegion(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { regionId: number },
  ) {
    const roomName = `region_${data.regionId}`;
    client.join(roomName);
    return { event: 'joinedRoom', data: { room: roomName } };
  }

  broadcastNewLead(regionId: number, leadData: any) {
    const roomName = `region_${regionId}`;
    this.server.to(roomName).emit('new_lead', leadData);
  }

  broadcastLeadClaimed(regionId: number, data: { leadId: number; claimedByAgentId: number }) {
    const roomName = `region_${regionId}`;
    this.server.to(roomName).emit('lead_claimed', data);
  }

  notifyCustomerLeadAccepted(customerId: number, data: any) {
    const roomName = `user_${customerId}`;
    this.server.to(roomName).emit('lead_accepted', data);
  }
}