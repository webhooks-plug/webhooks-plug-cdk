import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cr from "aws-cdk-lib/custom-resources";

// Change lambda imports when building CLI

// database credentials here
const envs = {
  DB_USER: process.env.DB_USER!,
  DB_PASSWORD: process.env.DB_PASSWORD!,
  DB_NAME: process.env.DB_NAME!,
  DB_HOST: process.env.DB_HOST!,
  DB_PORT: process.env.DB_PORT!,
};

class LambdaStack extends cdk.Stack {
  public dbLambda: lambda.Function;
  public logLambda: lambda.Function;
  public servicesLambda: lambda.Function;
  public eventTypesLambda: lambda.Function;
  public usersLambda: lambda.Function;
  public subscriptionsLambda: lambda.Function;

  constructor(
    scope: Construct,
    id: string,
    props?: cdk.StackProps & {
      appName: string;
    }
  ) {
    super(scope, id, props);
    const stack = cdk.Stack.of(scope);
    const appName = props?.appName;

    this.logLambda = new lambda.Function(this, `${appName}LogLambda`, {
      functionName: `${appName}LogLambda`,
      description: "Lambda function for sns logs",
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      timeout: cdk.Duration.seconds(250),
      environment: envs,
      code: lambda.Code.fromAsset("../webhooks-plug-backend/functions/logs"),
    });

    const envsUpdated = {
      ...envs,
      REGION: stack.region,
      LOG_DESTINATION_FUNCTION_ARN: this.logLambda.functionArn,
      LOG_DESTINATION_FUNCTION_NAME: this.logLambda.functionName,
    };

    // Create setup db lambda here and run cdk deploy manually for sql updates
    this.dbLambda = new lambda.Function(this, `${appName}DBLambda`, {
      functionName: `${appName}DBLambda`,
      description: "Lambda function for db schema",
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      timeout: cdk.Duration.seconds(250),
      environment: envs,
      code: lambda.Code.fromAsset(
        "../webhooks-plug-backend/functions/database"
      ),
    });

    this.servicesLambda = new lambda.Function(
      this,
      `${appName}ServicesLambda`,
      {
        functionName: `${appName}ServicesLambda`,
        description: "Lambda function for services module",
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "index.handler",
        timeout: cdk.Duration.seconds(250),
        environment: envs,
        code: lambda.Code.fromAsset(
          "../webhooks-plug-backend/functions/services"
        ),
      }
    );

    const servicesIntegration = new apigateway.LambdaIntegration(
      this.servicesLambda
    );

    this.eventTypesLambda = new lambda.Function(
      this,
      `${appName}EventTypesLambda`,
      {
        functionName: `${appName}EventTypesLambda`,
        description: "Lambda function for events type module",
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "index.handler",
        timeout: cdk.Duration.seconds(250),
        environment: envsUpdated,
        code: lambda.Code.fromAsset(
          "../webhooks-plug-backend/functions/event_types"
        ),
      }
    );

    const eventTypesIntegration = new apigateway.LambdaIntegration(
      this.eventTypesLambda
    );

    this.usersLambda = new lambda.Function(this, `${appName}UsersLambda`, {
      functionName: `${appName}UsersLambda`,
      description: "Lambda function for users module",
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      timeout: cdk.Duration.seconds(250),
      environment: envsUpdated,
      code: lambda.Code.fromAsset("../webhooks-plug-backend/functions/users"),
    });

    const usersIntegration = new apigateway.LambdaIntegration(this.usersLambda);

    this.subscriptionsLambda = new lambda.Function(
      this,
      `${appName}SubscriptionsLambda`,
      {
        functionName: `${appName}SubscriptionsLambda`,
        description: "Lambda function for subscriptions module",
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "index.handler",
        timeout: cdk.Duration.seconds(250),
        environment: envsUpdated,
        code: lambda.Code.fromAsset(
          "../webhooks-plug-backend/functions/subscriptions"
        ),
      }
    );

    const subscriptionsIntegration = new apigateway.LambdaIntegration(
      this.subscriptionsLambda
    );

    const api = new apigateway.RestApi(this, `${appName}API`, {
      restApiName: `${appName}API`,
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

    const key = api.addApiKey(`ApiKey${appName}`, {
      apiKeyName: "v1",
    });

    const plan = api.addUsagePlan(`UsagePlan${appName}`, {
      name: "v1",
      description: "Usage plan for webhooks plug infra",
      apiStages: [
        {
          api,
          stage: api.deploymentStage,
        },
      ],
    });

    plan.addApiKey(key);

    // Enpoints for event types lambda
    const eventTypesResource = api.root.addResource("event_types");
    eventTypesResource.addMethod("GET", eventTypesIntegration, {
      apiKeyRequired: true,
    });
    eventTypesResource.addMethod("POST", eventTypesIntegration, {
      apiKeyRequired: true,
    });

    const eventTypeResource = eventTypesResource.addResource("{event_type_id}");
    eventTypeResource.addMethod("GET", eventTypesIntegration, {
      apiKeyRequired: true,
    });
    eventTypeResource.addMethod("DELETE", eventTypesIntegration, {
      apiKeyRequired: true,
    });

    // Enpoints for subscriptions lambda
    const subscriptionsResource = api.root.addResource("subscriptions");
    subscriptionsResource.addMethod("GET", subscriptionsIntegration, {
      apiKeyRequired: true,
    });
    subscriptionsResource.addMethod("POST", subscriptionsIntegration, {
      apiKeyRequired: true,
    });

    const subscriptionResource =
      subscriptionsResource.addResource("{subscription_id}");
    subscriptionResource.addMethod("GET", subscriptionsIntegration, {
      apiKeyRequired: true,
    });
    subscriptionResource.addMethod("DELETE", subscriptionsIntegration, {
      apiKeyRequired: true,
    });

    // Enpoints for users lambda
    const usersResource = api.root.addResource("users");
    usersResource.addMethod("GET", usersIntegration, {
      apiKeyRequired: true,
    });
    usersResource.addMethod("POST", usersIntegration, {
      apiKeyRequired: true,
    });

    const userResource = usersResource.addResource("{user_id}");
    userResource.addMethod("GET", usersIntegration, {
      apiKeyRequired: true,
    });
    userResource.addMethod("DELETE", usersIntegration, {
      apiKeyRequired: true,
    });

    // Enpoints for services lambda
    const servicesResource = api.root.addResource("services");
    servicesResource.addMethod("GET", servicesIntegration, {
      apiKeyRequired: true,
    });
    servicesResource.addMethod("POST", servicesIntegration, {
      apiKeyRequired: true,
    });

    const serviceResource = servicesResource.addResource("{service_id}");
    serviceResource.addMethod("GET", servicesIntegration, {
      apiKeyRequired: true,
    });
    serviceResource.addMethod("DELETE", servicesIntegration, {
      apiKeyRequired: true,
    });

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
      physicalResourceId: cr.PhysicalResourceId.fromResponse(""),
      parameters: {
        FunctionName: this.dbLambda.functionName,
        InvocationType: "Event",
        LogType: "Tail",
        TriggerChange: "add_more_service_endpoints", // Change this to anything to trigger the call of the db lambda
      },
    };

    new cr.AwsCustomResource(this, "DB Lambda Custom Resource", {
      onUpdate: crAction,
      role: dbLambdaCrRole,
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });
  }
}

export default LambdaStack;
