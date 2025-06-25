import { Duration, RemovalPolicy, StackProps, Stack } from "aws-cdk-lib";
import {
  CorsHttpMethod,
  HttpApi,
  HttpMethod,
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  OriginAccessIdentity,
  OriginRequestPolicy,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin, S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import * as path from "path";

interface ServiceStackProps extends Omit<StackProps, "softwareType"> {
  stage: string;
  config: { cloudFrontDomain: string };
}

export type ServiceLambdas = {
  graphql?: Function;
};

export class DevOpsCdkStack extends Stack {
  private lambdas: ServiceLambdas;

  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);

    const webAssetsBucket = new Bucket(this, `${props.stage}-WebAssetsBucket`, {
      removalPolicy: RemovalPolicy.DESTROY,
      publicReadAccess: false,
      autoDeleteObjects: true,
      versioned: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });

    const staticAssets = new BucketDeployment(
      this,
      `${props.stage}-DeployDefaultPage`,
      {
        sources: [
          Source.asset(
            path.resolve(__dirname, "../node_modules/@conrose456/devops/out"),
          ),
        ],
        destinationBucket: webAssetsBucket,
        prune: false,
      },
    );

    const graphqlLambda = new Function(this, `${props.stage}-GraphQlLambda`, {
      runtime: Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: Code.fromAsset(
        path.resolve(
          __dirname,
          "../node_modules/@conrose456/devopsservice/dist",
        ),
      ),
    });

    const jwtSecret = new Secret(this, `${props.stage}-JWTSecret`, {
      secretName: `${props.stage.toLowerCase()}jwt-secret-key`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "admin" }),
        generateStringKey: "password",
        passwordLength: 64,
        excludeCharacters: '\"@/\\',
      },
    });
    jwtSecret.grantRead(graphqlLambda);

    graphqlLambda.addEnvironment("JWT_SECRET_NAME", jwtSecret.secretName);
    graphqlLambda.addEnvironment("STAGE", props.stage);
    this.lambdas = {
      graphql: graphqlLambda,
    };

    const httpApi = new HttpApi(this, `${props.stage}-GraphQlApiGateway`, {
      apiName: `${props.stage}-GraphQlService`,
      corsPreflight: {
        allowOrigins: [props.config.cloudFrontDomain],
        allowMethods: [CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
        allowHeaders: ["Content-Type"],
        allowCredentials: true,
        exposeHeaders: ["Set-Cookie"],
      },
    });

    httpApi.addRoutes({
      path: "/graphql",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        `${props.stage}-LambdaIntegration`,
        graphqlLambda,
      ),
    });

    const distribution = createCloudFrontDist({
      scope: this,
      bucket: webAssetsBucket,
      staticAssets,
      api: httpApi,
      props,
    });

    graphqlLambda.addEnvironment("CLOUDFRONT_DOMAIN", distribution.domainName);
  }

  public getLambdas = (): ServiceLambdas => this.lambdas;
}

const createCloudFrontDist = ({
  scope,
  bucket,
  staticAssets,
  api,
  props,
}: {
  scope: Construct;
  bucket: Bucket;
  staticAssets: BucketDeployment;
  api: HttpApi;
  props: ServiceStackProps;
}) => {
  const originAccessIdentity = new OriginAccessIdentity(
    scope,
    "OriginAccessIdentity",
  );

  bucket.grantRead(originAccessIdentity);

  const distribution = new Distribution(scope, `${props.stage}-Distribution`, {
    defaultRootObject: "index.html",
    errorResponses: [
      {
        httpStatus: 403,
        responseHttpStatus: 403,
        responsePagePath: "/404.html",
        ttl: Duration.seconds(30),
      },
      {
        httpStatus: 404,
        responseHttpStatus: 404,
        responsePagePath: "/404.html",
        ttl: Duration.seconds(30),
      },
      {
        httpStatus: 500,
        responseHttpStatus: 500,
        responsePagePath: "/404.html",
        ttl: Duration.seconds(30),
      },
    ],
    defaultBehavior: {
      origin: S3BucketOrigin.withOriginAccessIdentity(bucket, {
        originAccessIdentity,
      }),
      cachePolicy: CachePolicy.CACHING_OPTIMIZED,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    },
    additionalBehaviors: {
      "/graphql": {
        origin: new HttpOrigin(
          `${api.apiId}.execute-api.eu-west-2.amazonaws.com`,
        ), // Base API Gateway endpoint (without path)
        allowedMethods: AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_DISABLED,
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
    },
  });
  distribution.node.addDependency(staticAssets);

  return distribution;
};
