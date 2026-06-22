import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import { Role } from '@prisma/client';

type JwtPayload = {
  sub: number;
  phone: string;
  role: Role;
  iat: number;
  exp: number;
};

@Injectable()
export class TokenService {
  signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: JwtPayload = {
      ...payload,
      iat: now,
      exp: now + this.getAccessTokenTtlSeconds(),
    };

    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(fullPayload));
    const signature = this.sign(`${encodedHeader}.${encodedPayload}`);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private sign(value: string): string {
    return createHmac('sha256', this.getSecret())
      .update(value)
      .digest('base64url');
  }

  private base64UrlEncode(value: string): string {
    return Buffer.from(value).toString('base64url');
  }

  private getSecret(): string {
    return process.env.JWT_SECRET ?? 'dev-secret-change-me';
  }

  private getAccessTokenTtlSeconds(): number {
    const rawValue = process.env.JWT_ACCESS_TOKEN_TTL_SECONDS;
    const parsedValue = rawValue ? Number(rawValue) : 7 * 24 * 60 * 60;

    return Number.isFinite(parsedValue) && parsedValue > 0
      ? parsedValue
      : 7 * 24 * 60 * 60;
  }
}
