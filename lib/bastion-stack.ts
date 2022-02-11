import {
  aws_ec2,
  aws_iam,
  aws_ssm,
  Stack,
  StackProps,
  Tags,
} from "aws-cdk-lib";
import { Construct } from "constructs";

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
      vpc: aws_ec2.Vpc.fromLookup(this, "DefaultVpc", { isDefault: true }),
      vpcSubnets: { subnetType: aws_ec2.SubnetType.PUBLIC },
      blockDevices: [
        {
          deviceName: "/dev/xvda",
          volume: aws_ec2.BlockDeviceVolume.ebs(30, {
            volumeType: aws_ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
    });

    Tags.of(bastionInstance.instance).add("security:bastion", "true");

    bastionInstance.role.addManagedPolicy(
      aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
        "AmazonSSMManagedInstanceCore"
      )
    );

    const maintanenceWindow = new aws_ssm.CfnMaintenanceWindow(
      this,
      "BastionMaintanenceWindow",
      {
        allowUnassociatedTargets: false,
        cutoff: 0,
        duration: 1,
        name: this.stackName + "-Maintanence-Window",
        schedule: "cron(0 2 ? * * *)",
        scheduleTimezone: "Australia/Melbourne",
      }
    );

    const maintanenceTarget = new aws_ssm.CfnMaintenanceWindowTarget(
      this,
      "BastionMaintanenceTarget",
      {
        resourceType: "INSTANCE",
        targets: [
          {
            key: "tag:security:bastion",
            values: ["true"],
          },
        ],
        windowId: maintanenceWindow.ref,
      }
    );

    const taskRole = new aws_iam.Role(this, "AutomationRole", {
      inlinePolicies: {
        ec2Stop: new aws_iam.PolicyDocument({
          statements: [
            new aws_iam.PolicyStatement({
              effect: aws_iam.Effect.ALLOW,
              resources: ["*"],
              actions: [
                "ec2:StopInstances",
              ],
              conditions: {
                StringEquals: {
                  "aws:ResourceTag/security:bastion": "true",
                },
              },
            }),
            new aws_iam.PolicyStatement({
              effect: aws_iam.Effect.ALLOW,
              resources: ["*"],
              actions: [
                "ec2:DescribeInstances",
                "ec2:DescribeInstanceStatus",
              ],
            }),
          ],
        }),
      },
      assumedBy: new aws_iam.ServicePrincipal("ssm.amazonaws.com"),
    });

    new aws_ssm.CfnMaintenanceWindowTask(this, "BastionStop", {
      priority: 1,
      taskArn: "AWS-StopEC2Instance",
      taskType: "AUTOMATION",
      windowId: maintanenceWindow.ref,
      taskInvocationParameters: {
        maintenanceWindowAutomationParameters: {
          documentVersion: "1",
          parameters: {
            InstanceId: ["{{RESOURCE_ID}}"],
            AutomationAssumeRole: [taskRole.roleArn],
          },
        },
      },
      maxErrors: "1",
      maxConcurrency: "1",
      targets: [
        {
          key: "WindowTargetIds",
          values: [maintanenceTarget.ref],
        },
      ],
    });
  }
}
