#!/usr/bin/env node

import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import LambdaStack from "../lib/lambdas";
import { Construct } from "constructs";
import IAMStack from "../lib/iam";
import { Tags } from "aws-cdk-lib/core";

const app = new cdk.App();

const appName = "WebhooksPlug";

class WebPlugApp extends cdk.App {
  constructor() {
    super();
    {
      const lambdaStack = new LambdaStack(this, `${appName}LambdaStack`, {
        appName,
      });
      const iamStack = new IAMStack(this, `${appName}IAMStack`, {
        appName,
      });

      Tags.of(lambdaStack).add("Webhooks Infrastructure", "Webplug");
      Tags.of(iamStack).add("Webhooks Infrastructure", "Webplug");
    }
  }
}

new WebPlugApp().synth();
