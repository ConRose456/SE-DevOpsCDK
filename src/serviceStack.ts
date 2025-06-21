import { Duration, RemovalPolicy, StackProps, Stack } from "aws-cdk-lib";
import { CorsHttpMethod, HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import {
  CachePolicy,
  Distribution,
  OriginAccessIdentity,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import * as path from "path";

interface ServiceStackProps extends Omit<StackProps, "softwareType"> {
  stage: string;
}

export class DevOpsCdkStack extends Stack {
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
        sources: [Source.asset(
            path.resolve(__dirname, "../node_modules/@conrose456/dev_ops/out")
        )],
        destinationBucket: webAssetsBucket,
        prune: false,
      },
    );

    const distribution = createCloudFrontDist({
      scope: this,
      bucket: webAssetsBucket,
      staticAssets,
      props,
    });

    const graphqlLambda = new Function(this, `${props.stage}-GraphQlLambda`, {
        runtime: Runtime.NODEJS_18_X,
        handler: 'index.handler',
        code: Code.fromAsset(
            path.resolve(__dirname, '../node_modules/@conrose456/devopsservice/dist')
        )
    });

    const httpApi = new HttpApi(this, `${props.stage}-GraphQlApiGateway`, {
        apiName: `${props.stage}-GraphQlService`,
        corsPreflight: {
            allowOrigins: [`https://${distribution.domainName}`, "*"],
            allowMethods: [CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
            allowHeaders: ["Content-Type"]
        }
    });

    httpApi.addRoutes({
        path: "/graphql",
        methods: [HttpMethod.POST],
        integration: new HttpLambdaIntegration(`${props.stage}-LambdaIntegration`, graphqlLambda)
    });
  }
}

const createCloudFrontDist = ({
  scope,
  bucket,
  staticAssets,
  props,
}: {
  scope: Construct;
  bucket: Bucket;
  staticAssets: BucketDeployment
  props: ServiceStackProps;
}) => {
  const originAccessIdentity = new OriginAccessIdentity(
    scope,
    "OriginAccessIdentity",
  );

  bucket.grantRead(originAccessIdentity);

  const distribution = new Distribution(
    scope,
    `${props.stage}-Distribution`,
    {
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
    },
  );
  distribution.node.addDependency(staticAssets);

  return distribution;
};
