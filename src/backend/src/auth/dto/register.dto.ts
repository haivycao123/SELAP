import { Role } from '@prisma/client';

export class RegisterDto {
  name: string;
  email: string;
  phone: string;
  password: string;
  role?: Role;
}
