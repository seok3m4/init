import type { InterviewAnswer, InterviewQuestion, RuntimeInterviewSession } from "../interview.runtime.types";

export const INTERVIEW_REPOSITORY = Symbol("INTERVIEW_REPOSITORY");

export interface CreateMockInterviewSessionInput {
  candidateId: number;
  showQuestionText: boolean;
  questionIds: number[];
  startedAt: string;
  updatedAt: string;
}

export interface CreateInterviewAnswerInput {
  sessionId: number;
  questionId: number;
  videoFileId?: number;
  audioFileId?: number;
  durationSeconds: number;
  submittedAt: string;
}

export interface InterviewQuestionFilter {
  interviewType?: InterviewQuestion["interviewType"];
  postingId?: number;
  questionTypes?: readonly InterviewQuestion["questionType"][];
}

export interface InterviewRepository {
  listQuestions(filter?: InterviewQuestionFilter): InterviewQuestion[];
  findQuestion(questionId: number): InterviewQuestion | undefined;
  listOwnedMockSessions(candidateId: number): RuntimeInterviewSession[];
  findMockSession(sessionId: number): RuntimeInterviewSession | undefined;
  createMockSession(input: CreateMockInterviewSessionInput): RuntimeInterviewSession;
  findRecruitingRuntimeSession(sessionId: number): RuntimeInterviewSession | undefined;
  saveRecruitingRuntimeSession(session: RuntimeInterviewSession): RuntimeInterviewSession;
  saveRuntimeSession(session: RuntimeInterviewSession): RuntimeInterviewSession;
  listAnswersBySession(sessionId: number): InterviewAnswer[];
  countAnswersBySession(sessionId: number): number;
  findAnswer(sessionId: number, questionId: number): InterviewAnswer | undefined;
  findAnswerById(sessionId: number, answerId: number): InterviewAnswer | undefined;
  findLatestAnswer(sessionId: number): InterviewAnswer | undefined;
  createAnswer(input: CreateInterviewAnswerInput): InterviewAnswer;
}
