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
  DeferredPublicInterviewEntryAdapter,
  type PublicInterviewEntryAdapterPort,
} from "./service/public-interview-entry.adapter";
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
    {
      provide: PublicApplicationAuthAdapter,
      useFactory: (magicLinkStore: PublicApplicationMagicLinkStore, mailService: MailService) =>
        new PublicApplicationAuthAdapter(magicLinkStore, mailService),
      inject: [PublicApplicationMagicLinkStore, MailService],
    },
    DeferredPublicInterviewEntryAdapter,
    {
      provide: CompanyRecruitingService,
      useFactory: (
        repository: CompanyRecruitingRepositoryPort,
        invitationAdapter: CompanyRecruitingInvitationAdapterPort,
        publicApplicationAuthAdapter: PublicApplicationAuthAdapterPort,
        publicInterviewEntryAdapter: PublicInterviewEntryAdapterPort,
      ) => new CompanyRecruitingService(repository, invitationAdapter, publicApplicationAuthAdapter, publicInterviewEntryAdapter),
      inject: [
        PrismaCompanyRecruitingRepository,
        InMemoryCompanyRecruitingInvitationAdapter,
        PublicApplicationAuthAdapter,
        DeferredPublicInterviewEntryAdapter,
      ],
    },
  ],
})
export class CompanyRecruitingModule {}
