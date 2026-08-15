import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AccountStatus, Prisma, Role, User } from '@prisma/client';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResendEmailCodeDto } from './dto/resend-email-code.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import type { AuthenticatedUser } from './authenticated-user';

type AuthUser = Pick<
  User,
  | 'id'
  | 'name'
  | 'email'
  | 'phone'
  | 'role'
  | 'status'
  | 'emailVerifiedAt'
  | 'createdAt'
  | 'updatedAt'
>;

const EMAIL_VERIFICATION_TTL_MINUTES = 10;
const PASSWORD_RESET_TTL_MINUTES = 10;
const PASSWORD_RESET_TOKEN_TTL_MINUTES = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    this.validateRegisterDto(dto);

    const role = dto.role ?? Role.CUSTOMER;
    const status =
      role === Role.SALES_AGENT ? AccountStatus.PENDING : AccountStatus.ACTIVE;
    const hashedPassword = await this.passwordService.hash(dto.password);
    const email = dto.email.trim().toLowerCase();
    const verificationCode = this.generateVerificationCode();

    this.mailService.assertConfigured();

    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name.trim(),
          email,
          phone: dto.phone.trim(),
          password: hashedPassword,
          role,
          status,
          emailVerificationCodeHash: this.hashVerificationCode(
            email,
            verificationCode,
          ),
          emailVerificationCodeExpiresAt: this.getVerificationExpiryDate(),
          agentProfile: role === Role.SALES_AGENT ? { create: {} } : undefined,
        },
      });

      await this.mailService.sendVerificationCode({
        to: user.email,
        name: user.name,
        code: verificationCode,
      });

      return {
        user: this.toAuthUser(user),
        message:
          status === AccountStatus.PENDING
            ? 'Registration successful. Please verify your email. Sales agent account will still need admin approval.'
            : 'Registration successful. Please verify your email before logging in.',
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Phone number or email is already registered.',
        );
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

    if (user.role !== dto.role) {
      throw new UnauthorizedException(
        'Selected role does not match this account.',
      );
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('Email is not verified.');
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

  async me(currentUser: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
      include: {
        agentProfile: {
          include: {
            regions: {
              include: { region: true },
              orderBy: { assignedAt: 'desc' },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Access token is invalid.');
    }

    return {
      user: {
        ...this.toAuthUser(user),
        regions:
          user.agentProfile?.regions.map((assignment) => ({
            id: assignment.region.id,
            name: assignment.region.name,
            code: assignment.region.code,
            city: assignment.region.city,
            district: assignment.region.district,
            ward: assignment.region.ward,
            assignedAt: assignment.assignedAt,
          })) ?? [],
      },
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    this.validateEmail(dto.email);
    this.validateVerificationCode(dto.code);

    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException('Verification code is invalid.');
    }

    if (user.emailVerifiedAt) {
      return {
        user: this.toAuthUser(user),
        message: 'Email is already verified.',
      };
    }

    if (
      !user.emailVerificationCodeHash ||
      !user.emailVerificationCodeExpiresAt ||
      user.emailVerificationCodeExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(
        'Verification code is expired. Please request a new code.',
      );
    }

    if (
      !this.isVerificationCodeValid(
        email,
        dto.code,
        user.emailVerificationCodeHash,
      )
    ) {
      throw new BadRequestException('Verification code is invalid.');
    }

    const verifiedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationCodeHash: null,
        emailVerificationCodeExpiresAt: null,
      },
    });

    return {
      user: this.toAuthUser(verifiedUser),
      message: 'Email verified successfully.',
    };
  }

  async resendEmailCode(dto: ResendEmailCodeDto) {
    this.validateEmail(dto.email);

    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException('Email is not registered.');
    }

    if (user.emailVerifiedAt) {
      return {
        message: 'Email is already verified.',
      };
    }

    const verificationCode = this.generateVerificationCode();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationCodeHash: this.hashVerificationCode(
          email,
          verificationCode,
        ),
        emailVerificationCodeExpiresAt: this.getVerificationExpiryDate(),
      },
    });

    await this.mailService.sendVerificationCode({
      to: user.email,
      name: user.name,
      code: verificationCode,
    });

    return {
      message: 'Verification code has been sent.',
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    this.validateEmail(dto.email);
    this.mailService.assertConfigured();

    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return {
        message:
          'If this email is registered, a password reset code has been sent.',
      };
    }

    const resetCode = this.generateVerificationCode();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetCodeHash: this.hashPasswordResetCode(email, resetCode),
        passwordResetCodeExpiresAt: this.getPasswordResetExpiryDate(),
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
      },
    });

    await this.mailService.sendPasswordResetCode({
      to: user.email,
      name: user.name,
      code: resetCode,
    });

    return {
      message:
        'If this email is registered, a password reset code has been sent.',
    };
  }

  async verifyResetCode(dto: VerifyResetCodeDto) {
    this.validateEmail(dto.email);
    this.validateVerificationCode(dto.code);

    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (
      !user ||
      !user.passwordResetCodeHash ||
      !user.passwordResetCodeExpiresAt ||
      user.passwordResetCodeExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(
        'Password reset code is invalid or expired.',
      );
    }

    if (
      !this.isPasswordResetCodeValid(
        email,
        dto.code,
        user.passwordResetCodeHash,
      )
    ) {
      throw new BadRequestException(
        'Password reset code is invalid or expired.',
      );
    }

    const resetToken = this.generatePasswordResetToken();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetCodeHash: null,
        passwordResetCodeExpiresAt: null,
        passwordResetTokenHash: this.hashPasswordResetToken(resetToken),
        passwordResetTokenExpiresAt: this.getPasswordResetTokenExpiryDate(),
      },
    });

    return {
      resetToken,
      message: 'Password reset code verified.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    this.validateResetToken(dto.resetToken);
    this.validatePassword(dto.newPassword);

    const tokenHash = this.hashPasswordResetToken(dto.resetToken.trim());
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
      },
    });

    if (
      !user ||
      !user.passwordResetTokenExpiresAt ||
      user.passwordResetTokenExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(
        'Password reset token is invalid or expired.',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: await this.passwordService.hash(dto.newPassword),
        passwordResetCodeHash: null,
        passwordResetCodeExpiresAt: null,
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
      },
    });

    return {
      message: 'Password has been reset successfully.',
    };
  }

  private validateRegisterDto(dto: RegisterDto): void {
    if (!dto.name?.trim()) {
      throw new BadRequestException('Name is required.');
    }

    this.validatePhone(dto.phone);
    this.validateEmail(dto.email);
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
    this.validateRole(dto.role);

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

  private validateRole(role: Role): void {
    if (!Object.values(Role).includes(role)) {
      throw new BadRequestException('Role is required.');
    }
  }

  private validateEmail(email: string): void {
    if (!email?.trim()) {
      throw new BadRequestException('Email is required.');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new BadRequestException('Email format is invalid.');
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

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      throw new BadRequestException(
        'Password must contain at least one letter and one number.',
      );
    }
  }

  private validateVerificationCode(code: string): void {
    if (!/^\d{4}$/.test(code?.trim() ?? '')) {
      throw new BadRequestException('Verification code must contain 4 digits.');
    }
  }

  private generateVerificationCode(): string {
    return randomInt(0, 10000).toString().padStart(4, '0');
  }

  private getVerificationExpiryDate(): Date {
    return new Date(Date.now() + EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000);
  }

  private getPasswordResetExpiryDate(): Date {
    return new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
  }

  private getPasswordResetTokenExpiryDate(): Date {
    return new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);
  }

  private hashVerificationCode(email: string, code: string): string {
    return createHmac('sha256', this.getVerificationSecret())
      .update(`${email}:${code}`)
      .digest('hex');
  }

  private isVerificationCodeValid(
    email: string,
    code: string,
    storedHash: string,
  ): boolean {
    const codeHash = this.hashVerificationCode(email, code);
    const storedBuffer = Buffer.from(storedHash, 'hex');
    const codeBuffer = Buffer.from(codeHash, 'hex');

    return (
      storedBuffer.length === codeBuffer.length &&
      timingSafeEqual(storedBuffer, codeBuffer)
    );
  }

  private hashPasswordResetCode(email: string, code: string): string {
    return createHmac('sha256', this.getVerificationSecret())
      .update(`${email}:password-reset:${code}`)
      .digest('hex');
  }

  private generatePasswordResetToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private validateResetToken(resetToken: string): void {
    if (!resetToken?.trim()) {
      throw new BadRequestException('Password reset token is required.');
    }
  }

  private hashPasswordResetToken(resetToken: string): string {
    return createHmac('sha256', this.getVerificationSecret())
      .update(`password-reset-token:${resetToken}`)
      .digest('hex');
  }

  private isPasswordResetCodeValid(
    email: string,
    code: string,
    storedHash: string,
  ): boolean {
    const codeHash = this.hashPasswordResetCode(email, code);
    const storedBuffer = Buffer.from(storedHash, 'hex');
    const codeBuffer = Buffer.from(codeHash, 'hex');

    return (
      storedBuffer.length === codeBuffer.length &&
      timingSafeEqual(storedBuffer, codeBuffer)
    );
  }

  private getVerificationSecret(): string {
    return (
      process.env.EMAIL_VERIFICATION_SECRET ??
      process.env.JWT_SECRET ??
      'dev-email-verification-secret-change-me'
    );
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
