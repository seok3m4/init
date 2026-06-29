import { Injectable } from "@nestjs/common";
import {
  ApplicationStatus,
  AuthProvider,
  PostingStatus,
  ScreeningDecision,
  UserStatus,
  UserType,
  type Prisma,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import type { ApplicantRecord, NormalizedListQuery, RecruitmentRecord } from "./company-recruiting.types";

export type CreatePostingInput = {
  companyId: number;
  title: string;
  jobRole: string;
  jobDescription: string | null;
  startsOn: Date | null;
  endsOn: Date | null;
  status: PostingStatus;
};

export type CreateCandidateInput = {
  name: string;
  email: string;
  phone: string | null;
};

export type CreateApplicationInput = {
  postingId: number;
  candidateId: number;
};

export type UpdateApplicationScreeningInput = {
  screeningDecision: ScreeningDecision;
  screeningMemo: string | null;
};

export type CompanyRecruitingRepositoryPort = {
  createPosting(input: CreatePostingInput): Promise<RecruitmentRecord>;
  listPostings(companyId: number, query: NormalizedListQuery): Promise<RecruitmentRecord[]>;
  countPostings(companyId: number, query: NormalizedListQuery): Promise<number>;
  findPostingForCompany(postingId: number, companyId: number): Promise<RecruitmentRecord | null>;
  findApplicationByPostingAndEmail(postingId: number, email: string): Promise<{ applicationId: number } | null>;
  findOrCreateCandidate(input: CreateCandidateInput): Promise<{ candidateId: number }>;
  createApplication(input: CreateApplicationInput): Promise<ApplicantRecord>;
  listApplicationsForPosting(
    postingId: number,
    companyId: number,
    query: NormalizedListQuery,
  ): Promise<ApplicantRecord[]>;
  countApplicationsForPosting(postingId: number, companyId: number, query: NormalizedListQuery): Promise<number>;
  findApplicationForCompany(applicationId: number, companyId: number): Promise<ApplicantRecord | null>;
  updateApplicationScreening(
    applicationId: number,
    companyId: number,
    input: UpdateApplicationScreeningInput,
  ): Promise<ApplicantRecord | null>;
};

@Injectable()
export class PrismaCompanyRecruitingRepository implements CompanyRecruitingRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async createPosting(input: CreatePostingInput): Promise<RecruitmentRecord> {
    const posting = await this.prisma.posting.create({
      data: input,
      include: { _count: { select: { applications: true } } },
    });
    return mapPosting(posting);
  }

  async listPostings(companyId: number, query: NormalizedListQuery): Promise<RecruitmentRecord[]> {
    const postings = await this.prisma.posting.findMany({
      where: buildPostingWhere(companyId, query),
      orderBy: buildPostingOrderBy(query),
      skip: query.skip,
      take: query.take,
      include: { _count: { select: { applications: true } } },
    });
    return postings.map(mapPosting);
  }

  async countPostings(companyId: number, query: NormalizedListQuery): Promise<number> {
    return this.prisma.posting.count({ where: buildPostingWhere(companyId, query) });
  }

  async findPostingForCompany(postingId: number, companyId: number): Promise<RecruitmentRecord | null> {
    const posting = await this.prisma.posting.findFirst({
      where: { postingId, companyId },
      include: { _count: { select: { applications: true } } },
    });
    return posting ? mapPosting(posting) : null;
  }

  async findApplicationByPostingAndEmail(postingId: number, email: string): Promise<{ applicationId: number } | null> {
    return this.prisma.application.findFirst({
      where: {
        postingId,
        candidate: {
          user: {
            email,
          },
        },
      },
      select: { applicationId: true },
    });
  }

  async findOrCreateCandidate(input: CreateCandidateInput): Promise<{ candidateId: number }> {
    return this.prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email: input.email },
        include: { candidateProfile: true },
      });

      if (existingUser?.candidateProfile) {
        return { candidateId: existingUser.candidateProfile.candidateId };
      }

      if (existingUser) {
        const profile = await tx.candidateProfile.create({
          data: {
            userId: existingUser.userId,
            summary: "Registered by company recruiter.",
          },
        });
        return { candidateId: profile.candidateId };
      }

      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash: null,
          userType: UserType.CANDIDATE,
          name: input.name,
          phone: input.phone,
          status: UserStatus.PENDING,
          authProvider: AuthProvider.LOCAL,
        },
      });
      const profile = await tx.candidateProfile.create({
        data: {
          userId: user.userId,
          summary: "Registered by company recruiter.",
        },
      });
      return { candidateId: profile.candidateId };
    });
  }

  async createApplication(input: CreateApplicationInput): Promise<ApplicantRecord> {
    const application = await this.prisma.application.create({
      data: {
        postingId: input.postingId,
        candidateId: input.candidateId,
        applicationStatus: ApplicationStatus.SUBMITTED,
        screeningDecision: ScreeningDecision.UNDECIDED,
      },
      include: applicantInclude,
    });
    return mapApplicant(application);
  }

  async listApplicationsForPosting(
    postingId: number,
    companyId: number,
    query: NormalizedListQuery,
  ): Promise<ApplicantRecord[]> {
    const applications = await this.prisma.application.findMany({
      where: buildApplicationWhere(postingId, companyId, query),
      orderBy: buildApplicationOrderBy(query),
      skip: query.skip,
      take: query.take,
      include: applicantInclude,
    });
    return applications.map(mapApplicant);
  }

  async countApplicationsForPosting(postingId: number, companyId: number, query: NormalizedListQuery): Promise<number> {
    return this.prisma.application.count({
      where: buildApplicationWhere(postingId, companyId, query),
    });
  }

  async findApplicationForCompany(applicationId: number, companyId: number): Promise<ApplicantRecord | null> {
    const application = await this.prisma.application.findFirst({
      where: { applicationId, posting: { companyId } },
      include: applicantInclude,
    });
    return application ? mapApplicant(application) : null;
  }

  async updateApplicationScreening(
    applicationId: number,
    companyId: number,
    input: UpdateApplicationScreeningInput,
  ): Promise<ApplicantRecord | null> {
    const ownedApplication = await this.prisma.application.findFirst({
      where: { applicationId, posting: { companyId } },
      select: { applicationId: true },
    });
    if (!ownedApplication) {
      return null;
    }

    const application = await this.prisma.application.update({
      where: { applicationId },
      data: {
        screeningDecision: input.screeningDecision,
        screeningMemo: input.screeningMemo,
      },
      include: applicantInclude,
    });
    return mapApplicant(application);
  }
}

const applicantInclude = {
  candidate: {
    include: {
      user: true,
    },
  },
  posting: true,
  evaluationReports: {
    orderBy: { reportId: "desc" as const },
    take: 1,
    include: {
      scores: {
        include: {
          criterion: {
            include: {
              tag: true,
            },
          },
          evidences: true,
        },
      },
    },
  },
  interviewSessions: {
    orderBy: { sessionId: "desc" as const },
    take: 1,
  },
} satisfies Prisma.ApplicationInclude;

function buildPostingWhere(companyId: number, query: NormalizedListQuery): Prisma.PostingWhereInput {
  const q = query.q?.trim();
  return {
    companyId,
    ...(query.status ? { status: query.status as PostingStatus } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { jobRole: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

function buildApplicationWhere(
  postingId: number,
  companyId: number,
  query: NormalizedListQuery,
): Prisma.ApplicationWhereInput {
  const q = query.q?.trim();
  return {
    postingId,
    posting: { companyId },
    ...(q
      ? {
          OR: [
            { candidate: { user: { name: { contains: q, mode: "insensitive" } } } },
            { candidate: { user: { email: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
}

function buildPostingOrderBy(query: NormalizedListQuery): Prisma.PostingOrderByWithRelationInput {
  const allowed = new Set(["createdAt", "updatedAt", "startsOn", "endsOn", "title", "status"]);
  return { [allowed.has(query.sort) ? query.sort : "createdAt"]: query.order };
}

function buildApplicationOrderBy(query: NormalizedListQuery): Prisma.ApplicationOrderByWithRelationInput {
  const allowed = new Set(["updatedAt", "applicationStatus", "interviewStatus", "reportStatus"]);
  return { [allowed.has(query.sort) ? query.sort : "updatedAt"]: query.order };
}

function mapPosting(posting: Prisma.PostingGetPayload<{ include: { _count: { select: { applications: true } } } }>): RecruitmentRecord {
  return {
    postingId: posting.postingId,
    companyId: posting.companyId,
    title: posting.title,
    jobRole: posting.jobRole,
    jobDescription: posting.jobDescription,
    startsOn: posting.startsOn,
    endsOn: posting.endsOn,
    status: posting.status,
    createdAt: posting.createdAt,
    updatedAt: posting.updatedAt,
    applicantCount: posting._count.applications,
  };
}

type ApplicationWithIncludes = Prisma.ApplicationGetPayload<{ include: typeof applicantInclude }>;

function mapApplicant(application: ApplicationWithIncludes): ApplicantRecord {
  return {
    applicationId: application.applicationId,
    postingId: application.postingId,
    candidateId: application.candidateId,
    applicationStatus: application.applicationStatus,
    documentStatus: application.documentStatus,
    interviewStatus: application.interviewStatus,
    reportStatus: application.reportStatus,
    screeningDecision: application.screeningDecision,
    screeningMemo: application.screeningMemo,
    submittedAt: application.submittedAt,
    updatedAt: application.updatedAt,
    candidate: {
      candidateId: application.candidate.candidateId,
      user: {
        userId: application.candidate.user.userId,
        email: application.candidate.user.email,
        name: application.candidate.user.name,
        phone: application.candidate.user.phone,
      },
    },
    posting: {
      postingId: application.posting.postingId,
      title: application.posting.title,
      jobRole: application.posting.jobRole,
    },
    evaluationReports: application.evaluationReports.map((report) => ({
      reportId: report.reportId,
      status: report.status,
      totalScore: report.totalScore,
      summary: report.summary,
      generatedAt: report.generatedAt,
      scores: report.scores.map((score) => ({
        scoreId: score.scoreId,
        score: score.score,
        rationale: score.rationale,
        criterion: score.criterion
          ? {
              criterionId: score.criterion.criterionId,
              tagName: score.criterion.tag.name,
            }
          : null,
        evidences: score.evidences.map((evidence) => ({
          evidenceId: evidence.evidenceId,
          evidenceText: evidence.evidenceText,
        })),
      })),
    })),
    interviewSessions: application.interviewSessions.map((session) => ({
      sessionId: session.sessionId,
      status: session.status,
      interviewType: session.interviewType,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
    })),
  };
}
