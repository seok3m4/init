import { RecruitmentApplicantsPage } from "../../../../../features/company-recruiting/RecruitmentApplicantsPage";

type Props = {
  params: Promise<{ recruitmentId: string }>;
};

export default async function RecruitmentApplicantsRoute({ params }: Props) {
  const { recruitmentId } = await params;
  return <RecruitmentApplicantsPage recruitmentId={Number(recruitmentId)} />;
}
