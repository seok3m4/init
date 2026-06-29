import { AuthService } from "./auth.service";

describe("AuthService policy", () => {
  it("is defined for Jest wiring", () => {
    expect(AuthService).toBeDefined();
  });
});
