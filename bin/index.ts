#!/usr/bin/env node

import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import LambdaStack from "../lib/lambdas";
import { Construct } from "constructs";

const app = new cdk.App();

class WebhooksPlugStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    new LambdaStack(app, "LambdaStack", {});
  }
}

new WebhooksPlugStack(app, "WebhooksPlugStack");
