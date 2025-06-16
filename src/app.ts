import { App } from "aws-cdk-lib";
import { DevOpsCdkStack } from "./serviceStack";

const app = new App();

// beta
new DevOpsCdkStack(app, `Beta-ServiceStack`, {
  stage: "Beta"
});

// prod

new DevOpsCdkStack(app, `Prod-ServiceStack`, {
  stage: "Prod"
});