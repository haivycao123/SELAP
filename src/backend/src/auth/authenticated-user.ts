import { Role } from '@prisma/client';

export type AuthenticatedUser = {
  id: number;
  phone: string;
  role: Role;
};
