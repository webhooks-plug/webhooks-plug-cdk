import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cr from "aws-cdk-lib/custom-resources";

// database credentials here
const envs = {
  DB_USER: "postgres",
  DB_PASSWORD: "jbuwde93283nidjnewjduwehf9823832",
  DB_NAME: "postgres",
  DB_HOST: "db.jgbvgenaehlamnecgozh.supabase.co",
  DB_PORT: "5432",
};

class LambdaStack extends cdk.Stack {
  public dbLambda: lambda.Function;
  public servicesLambda: lambda.Function;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create setup db lambda here and run cdk deploy manually for sql updates
    this.dbLambda = new lambda.Function(this, `DBLambda`, {
      functionName: `DBLambda`,
      description: "Lambda function for db schema",
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
      description: "Lambda function for services module",
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

    new cdk.CfnOutput(this, "Webhooks plug API url", {
      value: api.url,
      description: "URL of the webhooks plug API Gateway",
    });

    // DB Lambda Custom Resource
    const dbLambdaCrRole = new iam.Role(
      this,
      "DB Lambda Custom Resource Role",
      {
        assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      }
    );

    dbLambdaCrRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: [this.dbLambda.functionArn],
      })
    );

    const crAction = {
      service: "Lambda",
      action: "invoke",
      physicalResourceId: cr.PhysicalResourceId.fromResponse("Payload"),
      parameters: {
        FunctionName: this.dbLambda.functionName,
        InvocationType: "RequestResponse",
        LogType: "Tail",
        TriggerChange: "fix_sql_errors", // Change this to anything to trigger the call of the db lambda
      },
    };

    new cr.AwsCustomResource(this, "DB Lambda Custom Resource", {
      onUpdate: crAction,
      onCreate: crAction,
      role: dbLambdaCrRole,
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });
  }
}

export default LambdaStack;
