import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";

const createRole = (stack: any, roleName: string, description: string) => {
  const newRole = new iam.Role(stack, roleName, {
    assumedBy: new iam.ServicePrincipal("sns.amazonaws.com"),
    roleName,
    description,
  });

  const inlinePolicyDocument = new iam.PolicyDocument({
    statements: [
      new iam.PolicyStatement({
        actions: ["logs:*"],
        resources: ["*"],
      }),
    ],
  });

  newRole.attachInlinePolicy(
    new iam.Policy(stack, `${roleName}Policy`, {
      document: inlinePolicyDocument,
    })
  );

  return newRole;
};

class IAMStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props?: cdk.StackProps & {
      appName: string;
    }
  ) {
    super(scope, id, props);

    const successRole = createRole(
      this,
      "SNSSuccessRole",
      "Role for SNS success notification"
    );
    const failureRole = createRole(
      this,
      "SNSFailureRole",
      "Role for SNS failure notification"
    );

    new cdk.CfnOutput(this, "SNSSuccessRoleArn", {
      value: successRole.roleArn,
    });

    new cdk.CfnOutput(this, "SNSFailureRoleArn", {
      value: failureRole.roleArn,
    });
  }
}

export default IAMStack;
