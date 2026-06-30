import { RecruitmentInterviewSettingsBridgePage } from "../../../../../features/company-recruiting/RecruitmentInterviewSettingsBridgePage";

type Props = {
  params: Promise<{ recruitmentId: string }>;
};

export default async function RecruitmentInterviewSettingsRoute({ params }: Props) {
  const { recruitmentId } = await params;
  return <RecruitmentInterviewSettingsBridgePage recruitmentId={Number(recruitmentId)} />;
}
