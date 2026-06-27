import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const now = () => new Date();

async function main() {
  const createdAt = now();

  await prisma.user.upsert({
    where: { userId: 1 },
    update: {
      email: "dev.company@example.com",
      userType: "COMPANY",
      name: "Dev Company User",
      status: "ACTIVE",
      authProvider: "LOCAL",
      updatedAt: createdAt,
    },
    create: {
      userId: 1,
      email: "dev.company@example.com",
      passwordHash: null,
      userType: "COMPANY",
      name: "Dev Company User",
      phone: null,
      status: "ACTIVE",
      authProvider: "LOCAL",
      providerUserId: null,
      createdAt,
      updatedAt: createdAt,
    },
  });

  await prisma.company.upsert({
    where: { companyId: 1 },
    update: {
      ownerUserId: 1,
      name: "Dev Company",
      verificationStatus: "VERIFIED",
      updatedAt: createdAt,
    },
    create: {
      companyId: 1,
      ownerUserId: 1,
      name: "Dev Company",
      businessRegistrationNumber: "0000000001",
      verificationStatus: "VERIFIED",
      industry: "IT",
      profile: "Local development company profile.",
      talentProfile: "Local development talent profile.",
      evaluationPolicy: "Local development evaluation policy.",
      createdAt,
      updatedAt: createdAt,
    },
  });

  await prisma.user.upsert({
    where: { userId: 2 },
    update: {
      email: "dev.candidate@example.com",
      userType: "CANDIDATE",
      name: "Dev Candidate User",
      status: "ACTIVE",
      authProvider: "LOCAL",
      updatedAt: createdAt,
    },
    create: {
      userId: 2,
      email: "dev.candidate@example.com",
      passwordHash: null,
      userType: "CANDIDATE",
      name: "Dev Candidate User",
      phone: null,
      status: "ACTIVE",
      authProvider: "LOCAL",
      providerUserId: null,
      createdAt,
      updatedAt: createdAt,
    },
  });

  await prisma.candidateProfile.upsert({
    where: { candidateId: 1 },
    update: {
      userId: 2,
      updatedAt: createdAt,
    },
    create: {
      candidateId: 1,
      userId: 2,
      defaultResumeFileId: null,
      portfolioUrl: null,
      githubUrl: null,
      summary: "Local development candidate profile.",
      createdAt,
      updatedAt: createdAt,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
