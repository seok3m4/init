import { Injectable } from "@nestjs/common";
import { resolveCurrentCandidate, type CandidateAuthHeaders, CandidateService } from "../candidate";
import { DeviceCheckDto } from "./interview.device-check.dto";

@Injectable()
export class InterviewService {
  constructor(private readonly candidateService: CandidateService) {}

  saveDeviceCheck(sessionId: number, dto: DeviceCheckDto, headers: CandidateAuthHeaders) {
    const currentUser = resolveCurrentCandidate(headers);
    return this.candidateService.saveDeviceCheck(sessionId, dto, currentUser);
  }

  startInterview(applicationId: number, headers: CandidateAuthHeaders) {
    const currentUser = resolveCurrentCandidate(headers);
    return this.candidateService.startInterview(applicationId, currentUser);
  }

  getInterviewRuntime(applicationId: number, headers: CandidateAuthHeaders) {
    const currentUser = resolveCurrentCandidate(headers);
    return this.candidateService.getInterviewRuntime(applicationId, currentUser);
  }
}
