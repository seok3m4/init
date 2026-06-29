import { Module } from "@nestjs/common";

import { PrismaService } from "../../shared/prisma.service";
import { AuthModule } from "../auth/auth.module";
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
  imports: [AuthModule],
  controllers: [CompanyRecruitingController],
  providers: [
    PrismaService,
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
