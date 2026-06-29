import { Injectable } from "@nestjs/common";

import type { ApplicantRecord } from "./company-recruiting.types";

export type InvitationAdapterInput = {
  application: ApplicantRecord;
  availableFrom: Date;
  availableUntil: Date;
  message: string;
};

export type InvitationAdapterResult = {
  invitationId: string;
  applicationId: number;
  availableFrom: Date;
  availableUntil: Date;
  message: string;
  deliveryStatus: "REQUESTED";
  temporary: true;
  temporaryBoundary: "B_MODULE_IN_MEMORY_INVITATION_ADAPTER";
  sessionConnection: {
    status: "REQUESTED_FROM_D_MODULE";
    interviewType: "RECRUITING";
    temporary: true;
  };
};

export type CompanyRecruitingInvitationAdapterPort = {
  requestInvitation(input: InvitationAdapterInput): Promise<InvitationAdapterResult>;
};

@Injectable()
export class InMemoryCompanyRecruitingInvitationAdapter implements CompanyRecruitingInvitationAdapterPort {
  private readonly requests = new Map<string, InvitationAdapterResult>();

  async requestInvitation(input: InvitationAdapterInput): Promise<InvitationAdapterResult> {
    const invitationId = `temp-invitation-${input.application.applicationId}-${Date.now()}`;
    const result: InvitationAdapterResult = {
      invitationId,
      applicationId: input.application.applicationId,
      availableFrom: input.availableFrom,
      availableUntil: input.availableUntil,
      message: input.message,
      deliveryStatus: "REQUESTED",
      temporary: true,
      temporaryBoundary: "B_MODULE_IN_MEMORY_INVITATION_ADAPTER",
      sessionConnection: {
        status: "REQUESTED_FROM_D_MODULE",
        interviewType: "RECRUITING",
        temporary: true,
      },
    };

    // Temporary B-owned boundary only. This is not durable storage, email delivery,
    // or D-owned interview_session creation.
    this.requests.set(invitationId, result);
    return result;
  }
}
