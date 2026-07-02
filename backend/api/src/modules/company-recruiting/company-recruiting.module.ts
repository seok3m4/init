import { Module } from "@nestjs/common";

import { PrismaService } from "../../shared/prisma.service";
import { AuthModule } from "../auth/auth.module";
import { MailService } from "../auth/service/mail.service";
import { CompanyRecruitingController } from "./controller/company-recruiting.controller";
import { PublicApplicationController } from "./controller/public-application.controller";
import { PublicRecruitmentController } from "./controller/public-recruitment.controller";
import {
  InMemoryCompanyRecruitingInvitationAdapter,
  type CompanyRecruitingInvitationAdapterPort,
} from "./service/company-recruiting-invitation.adapter";
import {
  PublicApplicationAuthAdapter,
  PublicApplicationMagicLinkStore,
  type PublicApplicationAuthAdapterPort,
} from "./service/public-application-auth.adapter";
import {
  PrismaCompanyRecruitingRepository,
  type CompanyRecruitingRepositoryPort,
} from "./repository/company-recruiting.repository";
import { CompanyRecruitingService } from "./service/company-recruiting.service";

@Module({
  imports: [AuthModule],
  controllers: [CompanyRecruitingController, PublicRecruitmentController, PublicApplicationController],
  providers: [
    PrismaService,
    MailService,
    PrismaCompanyRecruitingRepository,
    InMemoryCompanyRecruitingInvitationAdapter,
    PublicApplicationMagicLinkStore,
    PublicApplicationAuthAdapter,
    {
      provide: CompanyRecruitingService,
      useFactory: (
        repository: CompanyRecruitingRepositoryPort,
        invitationAdapter: CompanyRecruitingInvitationAdapterPort,
        publicApplicationAuthAdapter: PublicApplicationAuthAdapterPort,
      ) => new CompanyRecruitingService(repository, invitationAdapter, publicApplicationAuthAdapter),
      inject: [PrismaCompanyRecruitingRepository, InMemoryCompanyRecruitingInvitationAdapter, PublicApplicationAuthAdapter],
    },
  ],
})
export class CompanyRecruitingModule {}
