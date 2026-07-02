import { Module } from "@nestjs/common";

import { PrismaService } from "../../shared/prisma.service";
import { AuthModule } from "../auth/auth.module";
import { CompanyRecruitingController } from "./controller/company-recruiting.controller";
import {
  InMemoryCompanyRecruitingInvitationAdapter,
  type CompanyRecruitingInvitationAdapterPort,
} from "./service/company-recruiting-invitation.adapter";
import { S3CompanyRecruitingStorageAdapter } from "./service/company-recruiting-storage.adapter";
import {
  PrismaCompanyRecruitingRepository,
  type CompanyRecruitingRepositoryPort,
} from "./repository/company-recruiting.repository";
import {
  CompanyRecruitingService,
  type CompanyRecruitingStorageAdapterPort,
} from "./service/company-recruiting.service";

@Module({
  imports: [AuthModule],
  controllers: [CompanyRecruitingController],
  providers: [
    PrismaService,
    PrismaCompanyRecruitingRepository,
    InMemoryCompanyRecruitingInvitationAdapter,
    S3CompanyRecruitingStorageAdapter,
    {
      provide: CompanyRecruitingService,
      useFactory: (
        repository: CompanyRecruitingRepositoryPort,
        invitationAdapter: CompanyRecruitingInvitationAdapterPort,
        storageAdapter: CompanyRecruitingStorageAdapterPort,
      ) => new CompanyRecruitingService(repository, invitationAdapter, storageAdapter),
      inject: [
        PrismaCompanyRecruitingRepository,
        InMemoryCompanyRecruitingInvitationAdapter,
        S3CompanyRecruitingStorageAdapter,
      ],
    },
  ],
})
export class CompanyRecruitingModule {}
