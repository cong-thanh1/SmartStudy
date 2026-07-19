import { Router, type NextFunction, type Request, type Response } from "express";

import { getAuthClaims, requireAuth } from "../../middleware/require-auth.js";
import type { IAuthProvider, IUserProfileProvider } from "../../ports/index.js";
import { updateProfileSchema } from "./auth-schemas.js";

export function createProfileRouter(
  authProvider: IAuthProvider,
  profileProvider: IUserProfileProvider,
): Router {
  const router = Router();
  router.use(requireAuth(authProvider));
  router.get("/me", handle(async (_request, response) => {
    const user = await profileProvider.getProfile(getAuthClaims(response));
    response.status(200).json({ user });
  }));
  router.patch("/me", handle(async (request, response) => {
    const input = updateProfileSchema.parse(request.body);
    const user = await profileProvider.updateProfile(getAuthClaims(response), input);
    response.status(200).json({ user });
  }));
  return router;
}

type AsyncRouteHandler = (request: Request, response: Response) => Promise<void>;
function handle(handler: AsyncRouteHandler) {
  return (request: Request, response: Response, next: NextFunction): void => {
    handler(request, response).catch(next);
  };
}
