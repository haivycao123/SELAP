import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AccountStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './authenticated-user';
import { TokenService } from './token.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: AuthenticatedUser;
    }>();
    const token = this.extractBearerToken(request.headers.authorization);
    const payload = this.tokenService.verifyAccessToken(token);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        phone: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
      },
    });

    if (
      !user ||
      user.phone !== payload.phone ||
      user.role !== payload.role ||
      user.status !== AccountStatus.ACTIVE ||
      !user.emailVerifiedAt
    ) {
      throw new UnauthorizedException('Access token is invalid.');
    }

    request.user = {
      id: user.id,
      phone: user.phone,
      role: user.role,
    };

    return true;
  }

  private extractBearerToken(
    authorization: string | string[] | undefined,
  ): string {
    const value = Array.isArray(authorization)
      ? authorization[0]
      : authorization;

    if (!value?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token is required.');
    }

    const token = value.slice('Bearer '.length).trim();

    if (!token) {
      throw new UnauthorizedException('Bearer token is required.');
    }

    return token;
  }
}
