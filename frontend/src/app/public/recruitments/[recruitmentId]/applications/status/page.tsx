import { PublicApplicationStatusPage } from "@/features/company-recruiting/PublicApplicationStatusPage";

type Props = {
  params: Promise<{ recruitmentId: string }>;
};

export default async function PublicApplicationStatusRoute({ params }: Props) {
  const { recruitmentId } = await params;
  return <PublicApplicationStatusPage recruitmentId={Number(recruitmentId)} />;
}
