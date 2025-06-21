import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import { ServiceLambdas } from "./serviceStack";

interface ServiceStackProps extends Omit<StackProps, "softwareType"> {
  stage: string;
  lambdas: ServiceLambdas;
}

export class TablesStack extends Stack {
  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);

    const catalogueTable = new Table(this, `${props.stage}-CatalogueTable`, {
      tableName: `${props.stage}-Catalogue`,
      partitionKey: {
        name: ".partitionKey",
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy:
        props.stage === "Beta" ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
    });

    catalogueTable.grantReadData(props.lambdas.graphql);
  }
}
