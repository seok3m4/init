import { Module } from "@nestjs/common";

import { CompanyRecruitingModule } from "./modules/company-recruiting/company-recruiting.module";

@Module({
  imports: [CompanyRecruitingModule],
})
export class AppModule {}
