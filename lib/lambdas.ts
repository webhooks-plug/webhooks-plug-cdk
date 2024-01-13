import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";

// database credentials here
const envs = {
  DB_USER: "username",
  DB_PASSWORD: "password",
  DB_NAME: "webhooks-plug",
  DB_HOST: "host",
  DB_PORT: "port",
};

class LambdaStack extends cdk.Stack {
  public dbLambda: lambda.Function;
  public servicesLambda: lambda.Function;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create setup db lambda here and run cdk deploy manually for sql updates
    this.dbLambda = new lambda.Function(this, `DBLambda`, {
      functionName: `DBLambda`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      timeout: cdk.Duration.seconds(250),
      environment: envs,
      code: lambda.Code.fromAsset(
        "../webhooks-plug-backend/functions/database"
      ),
    });

    this.servicesLambda = new lambda.Function(this, `ServicesLambda`, {
      functionName: `ServicesLambda`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      timeout: cdk.Duration.seconds(250),
      environment: envs,
      code: lambda.Code.fromAsset(
        "../webhooks-plug-backend/functions/services"
      ),
    });

    const servicesIntegration = new apigateway.LambdaIntegration(
      this.servicesLambda
    );

    const api = new apigateway.RestApi(this, "WebhooksPlugAPI", {
      restApiName: "WebhooksPlugAPI",
      description: "API Gateway for webhooks plug",
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
      },
      deployOptions: {
        stageName: "v1",
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // TODO: Might change to ['*'] depending on whether this works or not
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
        maxAge: cdk.Duration.days(7),
      },
    });

    // Enpoints for services lambda
    const servicesResource = api.root.addResource("services");
    servicesResource.addMethod("GET", servicesIntegration);

    new cdk.CfnOutput(this, "Database Lambda", {
      value: this.dbLambda.functionArn,
      description: "ARN for database lambda",
    });
  }
}

export default LambdaStack;
