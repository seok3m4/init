export type CurrentUserType = "ADMIN" | "COMPANY" | "CANDIDATE";

export type CurrentUser = {
  userId: number;
  userType: CurrentUserType;
  companyId: number | null;
  candidateId: number | null;
};
