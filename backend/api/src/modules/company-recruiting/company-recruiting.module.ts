import { Module } from "@nestjs/common";

import { DevAuthGuard } from "../../common/dev-auth.guard";
import { PrismaService } from "../../prisma/prisma.service";
import { CompanyRecruitingController } from "./company-recruiting.controller";
import {
  InMemoryCompanyRecruitingInvitationAdapter,
  type CompanyRecruitingInvitationAdapterPort,
} from "./company-recruiting-invitation.adapter";
import {
  PrismaCompanyRecruitingRepository,
  type CompanyRecruitingRepositoryPort,
} from "./company-recruiting.repository";
import { CompanyRecruitingService } from "./company-recruiting.service";

@Module({
  controllers: [CompanyRecruitingController],
  providers: [
    PrismaService,
    DevAuthGuard,
    PrismaCompanyRecruitingRepository,
    InMemoryCompanyRecruitingInvitationAdapter,
    {
      provide: CompanyRecruitingService,
      useFactory: (
        repository: CompanyRecruitingRepositoryPort,
        invitationAdapter: CompanyRecruitingInvitationAdapterPort,
      ) => new CompanyRecruitingService(repository, invitationAdapter),
      inject: [PrismaCompanyRecruitingRepository, InMemoryCompanyRecruitingInvitationAdapter],
    },
  ],
})
export class CompanyRecruitingModule {}
