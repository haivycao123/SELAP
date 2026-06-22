import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AccountStatus, Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

type AuthUser = Pick<
  User,
  'id' | 'name' | 'phone' | 'role' | 'status' | 'createdAt' | 'updatedAt'
>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  async register(dto: RegisterDto) {
    this.validateRegisterDto(dto);

    const role = dto.role ?? Role.CUSTOMER;
    const status =
      role === Role.SALES_AGENT ? AccountStatus.PENDING : AccountStatus.ACTIVE;
    const hashedPassword = await this.passwordService.hash(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name.trim(),
          phone: dto.phone.trim(),
          password: hashedPassword,
          role,
          status,
          agentProfile:
            role === Role.SALES_AGENT ? { create: {} } : undefined,
        },
      });

      return {
        user: this.toAuthUser(user),
        message:
          status === AccountStatus.PENDING
            ? 'Sales agent account is pending admin approval.'
            : 'Registration successful.',
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Phone number is already registered.');
      }

      throw error;
    }
  }

  async login(dto: LoginDto) {
    this.validateLoginDto(dto);

    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone.trim() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid phone number or password.');
    }

    const isPasswordValid = await this.passwordService.verify(
      dto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid phone number or password.');
    }

    if (user.status !== AccountStatus.ACTIVE) {
      throw new ForbiddenException(
        `Account is ${user.status.toLowerCase()} and cannot log in.`,
      );
    }

    return {
      accessToken: this.tokenService.signAccessToken({
        sub: user.id,
        phone: user.phone,
        role: user.role,
      }),
      user: this.toAuthUser(user),
    };
  }

  private validateRegisterDto(dto: RegisterDto): void {
    if (!dto.name?.trim()) {
      throw new BadRequestException('Name is required.');
    }

    this.validatePhone(dto.phone);
    this.validatePassword(dto.password);

    const selfRegisterRoles: Role[] = [Role.CUSTOMER, Role.SALES_AGENT];

    if (dto.role && !selfRegisterRoles.includes(dto.role)) {
      throw new BadRequestException(
        'Only CUSTOMER and SALES_AGENT can self-register.',
      );
    }
  }

  private validateLoginDto(dto: LoginDto): void {
    this.validatePhone(dto.phone);

    if (!dto.password) {
      throw new BadRequestException('Password is required.');
    }
  }

  private validatePhone(phone: string): void {
    if (!phone?.trim()) {
      throw new BadRequestException('Phone number is required.');
    }

    if (!/^\+?[0-9]{9,15}$/.test(phone.trim())) {
      throw new BadRequestException('Phone number format is invalid.');
    }
  }

  private validatePassword(password: string): void {
    if (!password) {
      throw new BadRequestException('Password is required.');
    }

    if (password.length < 8) {
      throw new BadRequestException(
        'Password must contain at least 8 characters.',
      );
    }
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
