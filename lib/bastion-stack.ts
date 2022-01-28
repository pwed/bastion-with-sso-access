import {
  aws_ec2,
  aws_iam,
  aws_sso,
  Stack,
  StackProps,
  Tags,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import inlinePolicy from "./bastion-permission-set.json";

export class BastionStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const bastionInstance = new aws_ec2.Instance(this, "BastionInstance", {
      instanceType: aws_ec2.InstanceType.of(
        aws_ec2.InstanceClass.T3A,
        aws_ec2.InstanceSize.MICRO
      ),
      machineImage: aws_ec2.MachineImage.latestWindows(
        aws_ec2.WindowsVersion.WINDOWS_SERVER_2022_ENGLISH_FULL_BASE
      ),
      vpc: aws_ec2.Vpc.fromLookup(this, "DefaultVpc", {isDefault: true}),
      vpcSubnets: { subnetType: aws_ec2.SubnetType.PUBLIC },
    });

    // I have a custom schedule set up with the instance scheduler that
    //   will stop the instance at 11:59 pm if I forget to :)
    Tags.of(bastionInstance.instance).add("Schedule", "stop-nightly");

    bastionInstance.role.addManagedPolicy(
      aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
        "AmazonSSMManagedInstanceCore"
      )
    );

    const ssoInstanceArn = this.node.tryGetContext("ssoInstanceArn:account=" + this.account);

    if (!ssoInstanceArn) {
      console.error(
        `missing context 'ssoInstanceArn:account=${this.account}'. Add it to 'cdk.context.json'.`
      );
    }

    const permissionSet = new aws_sso.CfnPermissionSet(this, "PermissionSet", {
      instanceArn: ssoInstanceArn,
      inlinePolicy,
      name: "BastionPermissionSet",
      sessionDuration: 'PT8H',
      relayStateType: 'https://console.aws.amazon.com/systems-manager/managed-instances/rdp-connect'
    });
  }
}
