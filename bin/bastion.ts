#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { BastionStack } from "../lib/bastion-stack";
import { BastionSsoStack } from "../lib/sso-stack";
import { BastionMaintanenceStack } from "../lib/maintanence-stack";
import { RdsStack } from "../lib/rds-stack";

const app = new cdk.App();

const ssoStack = new BastionSsoStack(app, "BastionSsoStack", {
  env: {
    account: "967803995830",
    region: "us-east-1",
  },
  ssoInstanceArn: "arn:aws:sso:::instance/ssoins-72239eeffc775414",
  targetAccounts: ["806124249357"],
  userGuids: ["90675e1075-cfd89cb1-77fb-4900-b072-a9f063d507d8"],
});

const bastionStack = new BastionStack(app, "BastionStack", {
  env: {
    account: "806124249357",
    region: "us-east-1",
  },
  securityTagKey: ssoStack.securityTagKey,
  securityTagValue: ssoStack.securityTagValue,
});

new RdsStack(app, "RdsExampleStack", {
  env: {
    account: "806124249357",
    region: "us-east-1",
  },
  securityTagKey: ssoStack.securityTagKey,
  securityTagValue: ssoStack.securityTagValue,
  allowSecurityGroups: [bastionStack.securityGroup],
});

new BastionMaintanenceStack(app, "BastionMaintanenceStack", {
  env: {
    account: "806124249357",
    region: "us-east-1",
  },
  securityTagKey: ssoStack.securityTagKey,
  securityTagValue: ssoStack.securityTagValue,
});
