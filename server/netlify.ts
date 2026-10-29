import serverless from "serverless-http";
import { app, initPromise } from "./index";
import { registerTerminalHandlers } from "./app";

let serverlessHandler: ReturnType<typeof serverless> | undefined;

export const handler = async (event: unknown, context: unknown) => {
  // Ensure the server handles initialization exactly once (DB + env)
  await initPromise;

  if (!serverlessHandler) {
    // In serverless there is no static/vite setup, so terminal handlers
    // (404 + central error handling) are registered on the first request.
    registerTerminalHandlers(app);
    serverlessHandler = serverless(app);
  }

  return await serverlessHandler(event as never, context as never);
};
