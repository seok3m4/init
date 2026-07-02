import { PublicApplicationStatusPage } from "@/features/company-recruiting/PublicApplicationStatusPage";

type Props = {
  params: Promise<{ recruitmentId: string }>;
  searchParams: Promise<{ email?: string }>;
};

export default async function PublicApplicationStatusRoute({ params, searchParams }: Props) {
  const { recruitmentId } = await params;
  const { email } = await searchParams;
  return <PublicApplicationStatusPage initialEmail={email ?? ""} recruitmentId={Number(recruitmentId)} />;
}
