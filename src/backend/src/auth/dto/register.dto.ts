import { Role } from '@prisma/client';

export class RegisterDto {
  name: string;
  phone: string;
  password: string;
  role?: Role;
}
