import { CompanyPostingsPage } from "./CompanyPostingsPage";
import { ApplicantEvaluationPage } from "./ApplicantEvaluationPage";
import { RecruitmentApplicantsPage } from "./RecruitmentApplicantsPage";

const companyRecruitingEntryRoutes = {
  dashboard: "/company/applications/dashboard",
  recruitmentApplicants: "/company/recruitments/:recruitmentId/applicants",
  applicantEvaluation: "/company/applicants/:applicantId/evaluation",
} as const satisfies {
  dashboard: "/company/applications/dashboard";
  recruitmentApplicants: "/company/recruitments/:recruitmentId/applicants";
  applicantEvaluation: "/company/applicants/:applicantId/evaluation";
};

void CompanyPostingsPage;
void RecruitmentApplicantsPage;
void ApplicantEvaluationPage;
void companyRecruitingEntryRoutes;
