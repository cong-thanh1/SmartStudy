import process from "node:process";

import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

import { getSeedUserInput } from "../src/database/seed-user.js";
import { PrismaClient } from "../src/generated/prisma/client.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database");
}

const seedUser = getSeedUserInput(process.env);
const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

try {
  const passwordHash = await hash(seedUser.password, 12);

  await prisma.user.upsert({
    create: {
      email: seedUser.email,
      fullName: seedUser.fullName,
      passwordHash,
    },
    update: {
      fullName: seedUser.fullName,
      passwordHash,
    },
    where: {
      email: seedUser.email,
    },
  });

  console.log(`Seeded sample user: ${seedUser.email}`);
} finally {
  await prisma.$disconnect();
}
