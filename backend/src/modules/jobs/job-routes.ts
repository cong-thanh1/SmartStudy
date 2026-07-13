import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { getAuthClaims, requireAuth } from "../../middleware/require-auth.js";
import type { IAuthProvider } from "../../ports/index.js";
import type { AiJobService } from "./ai-job-service.js";

export function createJobRouter(auth: IAuthProvider, jobs: AiJobService): Router {
  const router = Router(); router.use(requireAuth(auth));
  router.get("/:jobId", handle(async (request, response) => {
    const { jobId } = z.object({ jobId: z.string().uuid() }).parse(request.params);
    const job = await jobs.get(jobId, getAuthClaims(response).sub);
    if (!job) { response.status(404).json({ error: { code: "JOB_NOT_FOUND", message: "Job was not found" } }); return; }
    response.status(200).json({ job });
  }));
  return router;
}
function handle(handler: (request: Request, response: Response) => Promise<void>) { return (request: Request, response: Response, next: NextFunction): void => { handler(request, response).catch(next); }; }
