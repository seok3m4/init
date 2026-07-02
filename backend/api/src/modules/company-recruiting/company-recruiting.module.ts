import { Module } from "@nestjs/common";

import { PrismaService } from "../../shared/prisma.service";
import { AuthModule } from "../auth/auth.module";
import { CompanyRecruitingController } from "./controller/company-recruiting.controller";
import { PublicRecruitmentController } from "./controller/public-recruitment.controller";
import {
  InMemoryCompanyRecruitingInvitationAdapter,
  type CompanyRecruitingInvitationAdapterPort,
} from "./service/company-recruiting-invitation.adapter";
import {
  InMemoryPublicApplicationAuthAdapter,
  type PublicApplicationAuthAdapterPort,
} from "./service/public-application-auth.adapter";
import {
  PrismaCompanyRecruitingRepository,
  type CompanyRecruitingRepositoryPort,
} from "./repository/company-recruiting.repository";
import { CompanyRecruitingService } from "./service/company-recruiting.service";

@Module({
  imports: [AuthModule],
  controllers: [CompanyRecruitingController, PublicRecruitmentController],
  providers: [
    PrismaService,
    PrismaCompanyRecruitingRepository,
    InMemoryCompanyRecruitingInvitationAdapter,
    InMemoryPublicApplicationAuthAdapter,
    {
      provide: CompanyRecruitingService,
      useFactory: (
        repository: CompanyRecruitingRepositoryPort,
        invitationAdapter: CompanyRecruitingInvitationAdapterPort,
        publicApplicationAuthAdapter: PublicApplicationAuthAdapterPort,
      ) => new CompanyRecruitingService(repository, invitationAdapter, publicApplicationAuthAdapter),
      inject: [PrismaCompanyRecruitingRepository, InMemoryCompanyRecruitingInvitationAdapter, InMemoryPublicApplicationAuthAdapter],
    },
  ],
})
export class CompanyRecruitingModule {}
