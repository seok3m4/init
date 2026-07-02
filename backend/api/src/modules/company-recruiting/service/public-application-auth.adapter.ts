import { Injectable } from "@nestjs/common";

export type PublicApplicationAuthRequest = {
  applicationId: number;
  recruitmentId: number;
  email: string;
};

export type PublicApplicationAuthResult = {
  emailVerificationStatus: "PENDING";
  nextAction: "CHECK_EMAIL";
  temporary: true;
  temporaryBoundary: "B_MODULE_PUBLIC_APPLICATION_AUTH_ADAPTER";
  magicLinkDeliveryStatus: "NOT_SENT_TEMPORARY";
};

export type PublicApplicationAuthAdapterPort = {
  requestEmailVerification(input: PublicApplicationAuthRequest): Promise<PublicApplicationAuthResult>;
};

@Injectable()
export class InMemoryPublicApplicationAuthAdapter implements PublicApplicationAuthAdapterPort {
  async requestEmailVerification(_input: PublicApplicationAuthRequest): Promise<PublicApplicationAuthResult> {
    return {
      emailVerificationStatus: "PENDING",
      nextAction: "CHECK_EMAIL",
      temporary: true,
      temporaryBoundary: "B_MODULE_PUBLIC_APPLICATION_AUTH_ADAPTER",
      magicLinkDeliveryStatus: "NOT_SENT_TEMPORARY",
    };
  }
}
