import { CandidateJobApplyPage } from "../../../../../features/candidate-application-interview/CandidatePages";

type Props = {
  params: Promise<{ jobId: string }>;
};

export default async function CandidateJobApplyRoute({ params }: Props) {
  const { jobId } = await params;
  return <CandidateJobApplyPage jobId={Number(jobId)} />;
}
