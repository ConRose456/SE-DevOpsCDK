import { Duration, RemovalPolicy, StackProps, Stack } from "aws-cdk-lib";
import {
  CachePolicy,
  Distribution,
  OriginAccessIdentity,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

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

    const defaultPage = new BucketDeployment(
      this,
      `${props.stage}-DeployDefaultPage`,
      {
        sources: [Source.data("index.html", `<!DOCTYPE html><html></html>`)],
        destinationBucket: webAssetsBucket,
        prune: false,
      },
    );

    createCloudFrontDist({
      scope: this,
      bucket: webAssetsBucket,
      defaultPage,
      props,
    });
  }
}

const createCloudFrontDist = ({
  scope,
  bucket,
  defaultPage,
  props,
}: {
  scope: Construct;
  bucket: Bucket;
  defaultPage: BucketDeployment;
  props: ServiceStackProps;
}) => {
  const originAccessIdentity = new OriginAccessIdentity(
    scope,
    "OriginAccessIdentity",
  );

  const distribution = new Distribution(
    scope,
    `${props.stage}-Distribution`,
    {
      defaultRootObject: "/index.html",
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 403,
          responsePagePath: "/index.html",
          ttl: Duration.seconds(30),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 404,
          responsePagePath: "/index.html",
          ttl: Duration.seconds(30),
        },
        {
          httpStatus: 500,
          responseHttpStatus: 500,
          responsePagePath: "/index.html",
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
  distribution.node.addDependency(defaultPage);
};
