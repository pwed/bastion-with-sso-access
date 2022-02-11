import * as cdk from "aws-cdk-lib";
import { StackProps } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as Bastion from "../lib/bastion-stack";

const stackProps: StackProps = {
  env: {
    account: "806124249357",
    region: "us-east-1",
  },
};

// example test. To run these tests, uncomment this file along with the
// example resource in lib/bastion-stack.ts
test("Bastion Created", () => {
  const app = new cdk.App();
  //     // WHEN
  const stack = new Bastion.BastionStack(app, "MyTestStack", stackProps);
  //     // THEN
  const template = Template.fromStack(stack);

  template.hasResourceProperties("AWS::EC2::Instance", {});
});
