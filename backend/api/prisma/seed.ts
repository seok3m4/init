import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const now = () => new Date();

const criterionTagSeeds = [
  {
    tagId: 1,
    jobRole: "Backend Developer",
    name: "API 설계",
    description: "REST API 계약과 모듈 경계를 이해하고 설계하는 역량",
    category: "기술역량",
    sortOrder: 1,
  },
  {
    tagId: 2,
    jobRole: "Backend Developer",
    name: "DB 모델링",
    description: "데이터 모델과 트랜잭션 경계를 설계하는 역량",
    category: "기술역량",
    sortOrder: 2,
  },
  {
    tagId: 3,
    jobRole: "Backend Developer",
    name: "장애 대응",
    description: "장애 원인을 좁히고 재발 방지책을 정리하는 역량",
    category: "문제해결",
    sortOrder: 3,
  },
  {
    tagId: 4,
    jobRole: "Frontend Developer",
    name: "UI 상태 설계",
    description: "사용자 입력, 로딩, 실패 상태를 일관되게 설계하는 역량",
    category: "기술역량",
    sortOrder: 4,
  },
  {
    tagId: 5,
    jobRole: "Frontend Developer",
    name: "접근성",
    description: "키보드 조작과 의미 있는 마크업을 고려하는 역량",
    category: "품질",
    sortOrder: 5,
  },
  {
    tagId: 6,
    jobRole: "Fullstack Developer",
    name: "요구사항 분해",
    description: "요구사항을 API, UI, 데이터 변경 단위로 나누는 역량",
    category: "문제해결",
    sortOrder: 6,
  },
  {
    tagId: 7,
    jobRole: "Common",
    name: "협업 커뮤니케이션",
    description: "요구사항과 제약을 명확하게 공유하는 역량",
    category: "협업",
    sortOrder: 7,
  },
  {
    tagId: 8,
    jobRole: "Common",
    name: "학습 민첩성",
    description: "새로운 도구와 도메인을 빠르게 이해하고 적용하는 역량",
    category: "성장",
    sortOrder: 8,
  },
];

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

  for (const tag of criterionTagSeeds) {
    await prisma.criterionTag.upsert({
      where: { tagId: tag.tagId },
      update: {
        jobRole: tag.jobRole,
        name: tag.name,
        description: tag.description,
        category: tag.category,
        isActive: true,
        sortOrder: tag.sortOrder,
      },
      create: {
        tagId: tag.tagId,
        jobRole: tag.jobRole,
        name: tag.name,
        description: tag.description,
        category: tag.category,
        isActive: true,
        sortOrder: tag.sortOrder,
      },
    });
  }
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
