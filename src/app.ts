import { App } from "aws-cdk-lib";
import { DevOpsCdkStack } from "./serviceStack";
import { TablesStack } from "./tablesStack";
import { CONFIG } from "./config";

const app = new App();

// beta
const betaConfig = CONFIG.stages.beta;

const betaService = new DevOpsCdkStack(app, `${betaConfig.name}-ServiceStack`, {
  stage: betaConfig.name,
});

new TablesStack(app, `${betaConfig.name}-TablesStack`, {
  stage: betaConfig.name,
  lambdas: betaService.getLambdas(),
});

// prod
const prodConfig = CONFIG.stages.prod;

const prodService = new DevOpsCdkStack(app, `${prodConfig.name}-ServiceStack`, {
  stage: prodConfig.name,
});

new TablesStack(app, `${prodConfig.name}-TablesStack`, {
  stage: prodConfig.name,
  lambdas: prodService.getLambdas(),
});
