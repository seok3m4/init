import { CompanyPostingsPage } from "./CompanyPostingsPage";
import { ApplicantEvaluationPage } from "./ApplicantEvaluationPage";
import { RecruitmentCreatePage } from "./RecruitmentCreatePage";
import { RecruitmentApplicantsPage } from "./RecruitmentApplicantsPage";
import { buildInterviewSettingsHref } from "./RecruitmentDetailPage";
import { RecruitmentSettingsPage } from "./RecruitmentSettingsPage";

const companyRecruitingEntryRoutes = {
  dashboard: "/company/applications/dashboard",
  recruitmentCreate: "/company/recruitments/new",
  recruitmentDashboard: "/company/recruitments/:recruitmentId",
  recruitmentSettings: "/company/recruitments/:recruitmentId/settings",
  recruitmentApplicants: "/company/recruitments/:recruitmentId/applicants",
  applicantEvaluation: "/company/applicants/:applicantId/evaluation",
  companyInterviewSettings: "/company/interviews/settings?postingId=:postingId",
} as const satisfies {
  dashboard: "/company/applications/dashboard";
  recruitmentCreate: "/company/recruitments/new";
  recruitmentDashboard: "/company/recruitments/:recruitmentId";
  recruitmentSettings: "/company/recruitments/:recruitmentId/settings";
  recruitmentApplicants: "/company/recruitments/:recruitmentId/applicants";
  applicantEvaluation: "/company/applicants/:applicantId/evaluation";
  companyInterviewSettings: "/company/interviews/settings?postingId=:postingId";
};

const interviewSettingsHref: `/company/interviews/settings?postingId=${number}` = buildInterviewSettingsHref(1);

void CompanyPostingsPage;
void RecruitmentCreatePage;
void RecruitmentSettingsPage;
void RecruitmentApplicantsPage;
void ApplicantEvaluationPage;
void interviewSettingsHref;
void companyRecruitingEntryRoutes;
