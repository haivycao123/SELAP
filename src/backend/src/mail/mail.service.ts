import { Injectable, InternalServerErrorException } from '@nestjs/common';
import nodemailer from 'nodemailer';

type VerificationEmailParams = {
  to: string;
  name: string;
  code: string;
};

@Injectable()
export class MailService {
  assertConfigured(): void {
    this.getRequiredEnv('SMTP_HOST');
    this.getRequiredEnv('SMTP_USER');
    this.getRequiredEnv('SMTP_PASS');
    this.getSmtpPort();
  }

  async sendVerificationCode(params: VerificationEmailParams): Promise<void> {
    this.assertConfigured();

    const transporter = nodemailer.createTransport({
      host: this.getRequiredEnv('SMTP_HOST'),
      port: this.getSmtpPort(),
      secure: this.getSmtpSecure(),
      auth: {
        user: this.getRequiredEnv('SMTP_USER'),
        pass: this.getRequiredEnv('SMTP_PASS'),
      },
    });

    await transporter.sendMail({
      from: process.env.MAIL_FROM ?? this.getRequiredEnv('SMTP_USER'),
      to: params.to,
      subject: 'SELAP email verification code',
      text: `Hello ${params.name}, your SELAP verification code is ${params.code}. This code expires in 10 minutes.`,
      html: `
        <p>Hello ${this.escapeHtml(params.name)},</p>
        <p>Your SELAP verification code is:</p>
        <p style="font-size: 24px; font-weight: 700; letter-spacing: 4px;">${params.code}</p>
        <p>This code expires in 10 minutes.</p>
      `,
    });
  }

  async sendPasswordResetCode(params: VerificationEmailParams): Promise<void> {
    this.assertConfigured();

    const transporter = nodemailer.createTransport({
      host: this.getRequiredEnv('SMTP_HOST'),
      port: this.getSmtpPort(),
      secure: this.getSmtpSecure(),
      auth: {
        user: this.getRequiredEnv('SMTP_USER'),
        pass: this.getRequiredEnv('SMTP_PASS'),
      },
    });

    await transporter.sendMail({
      from: process.env.MAIL_FROM ?? this.getRequiredEnv('SMTP_USER'),
      to: params.to,
      subject: 'SELAP password reset code',
      text: `Hello ${params.name}, your SELAP password reset code is ${params.code}. This code expires in 10 minutes.`,
      html: `
        <p>Hello ${this.escapeHtml(params.name)},</p>
        <p>Your SELAP password reset code is:</p>
        <p style="font-size: 24px; font-weight: 700; letter-spacing: 4px;">${params.code}</p>
        <p>This code expires in 10 minutes.</p>
      `,
    });
  }

  private getRequiredEnv(name: string): string {
    const value = process.env[name];

    if (!value?.trim()) {
      throw new InternalServerErrorException(`${name} is not configured.`);
    }

    return value.trim();
  }

  private getSmtpPort(): number {
    const port = Number(process.env.SMTP_PORT ?? 587);

    if (!Number.isInteger(port) || port <= 0) {
      throw new InternalServerErrorException('SMTP_PORT is invalid.');
    }

    return port;
  }

  private getSmtpSecure(): boolean {
    return process.env.SMTP_SECURE === 'true';
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
