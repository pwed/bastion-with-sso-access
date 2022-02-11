#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { BastionStack } from "../lib/bastion-stack";
import { BastionSsoStack } from "../lib/sso-stack";

const app = new cdk.App();

new BastionSsoStack(app, "BastionSsoStack", {
  env: {
    account: "967803995830",
    region: "us-east-1",
  },
  ssoInstanceArn: "arn:aws:sso:::instance/ssoins-7223575bcae77877",
  targetAccounts: ["806124249357"],
  userGuids: ["9067545123-35b2a7c5-aaa4-4b80-b8b5-6918aa5db5f3"],
});

new BastionStack(app, "BastionStack", {
  env: {
    account: "806124249357",
    region: "us-east-1",
  },
});
