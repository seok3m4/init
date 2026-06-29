import { createParamDecorator, ExecutionContext } from "@nestjs/common";

import type { CurrentUser } from "./current-user.type";

export const CurrentUserParam = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUser => {
    const request = context.switchToHttp().getRequest<{ currentUser?: CurrentUser }>();
    if (!request.currentUser) {
      throw new Error("CurrentUser is missing. Check DevAuthGuard configuration.");
    }
    return request.currentUser;
  },
);
