const { PrismaClient, AccountStatus, Role } = require('@prisma/client');
const { randomBytes, scryptSync } = require('crypto');

const prisma = new PrismaClient();
const KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = scryptSync(password, salt, KEY_LENGTH);

  return `${salt}:${key.toString('hex')}`;
}

function requireEnv(name) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

function validatePhone(phone) {
  if (!/^\+?[0-9]{9,15}$/.test(phone)) {
    throw new Error('ADMIN_PHONE format is invalid.');
  }
}

function validatePassword(password) {
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must contain at least 8 characters.');
  }
}

async function main() {
  const name = process.env.ADMIN_NAME?.trim() || 'System Admin';
  const email = requireEnv('ADMIN_EMAIL').toLowerCase();
  const phone = requireEnv('ADMIN_PHONE');
  const password = requireEnv('ADMIN_PASSWORD');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('ADMIN_EMAIL format is invalid.');
  }

  validatePhone(phone);
  validatePassword(password);

  const user = await prisma.user.upsert({
    where: { phone },
    update: {
      name,
      email,
      password: hashPassword(password),
      role: Role.ADMIN,
      status: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      emailVerificationCodeHash: null,
      emailVerificationCodeExpiresAt: null,
      approvedAt: new Date(),
      rejectedAt: null,
      rejectReason: null,
    },
    create: {
      name,
      email,
      phone,
      password: hashPassword(password),
      role: Role.ADMIN,
      status: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      approvedAt: new Date(),
    },
  });

  console.log(`Admin account is ready: ${user.phone}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
