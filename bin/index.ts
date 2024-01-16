#!/usr/bin/env node

import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import LambdaStack from "../lib/lambdas";
import { Construct } from "constructs";

const app = new cdk.App();

const appName = "WebhooksPlug";

class WebhooksPlugStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new LambdaStack(this, `${appName}LambdaStack`, {
      appName,
    });
  }
}

new WebhooksPlugStack(app, "WebhooksPlugStack");
