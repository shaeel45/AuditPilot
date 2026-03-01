import serverless from "serverless-http";
import { app, initPromise } from "./index";

let serverlessHandler: any;

export const handler = async (event: any, context: any) => {
    // Ensure the server handles initialization once
    await initPromise;

    if (!serverlessHandler) {
        serverlessHandler = serverless(app);
    }

    return await serverlessHandler(event, context);
};
