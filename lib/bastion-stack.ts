import {
  aws_ec2,
  aws_iam,
  aws_sso,
  Stack,
  StackProps,
  Tags,
} from "aws-cdk-lib";
import { BlockDeviceVolume } from "aws-cdk-lib/aws-ec2";
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
          volume: BlockDeviceVolume.ebs(10, {
            volumeType: aws_ec2.EbsDeviceVolumeType.GP3,
            iops: 3000,
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

    const ssoInstanceArn = this.node.tryGetContext(
      "ssoInstanceArn:account=" + this.account
    );

    if (!ssoInstanceArn) {
      console.error(
        `missing context 'ssoInstanceArn:account=${this.account}'. Add it to 'cdk.context.json'.`
      );
    }

    new aws_sso.CfnPermissionSet(this, "BastionAccessPermissionSet", {
      instanceArn: ssoInstanceArn,
      inlinePolicy: getPermissionSet(),
      name: "BastionAccess",
      sessionDuration: "PT8H",
      relayStateType:
        "https://console.aws.amazon.com/systems-manager/managed-instances/rdp-connect",
    });
  }
}

function getPermissionSet(): any {
  return {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "SSO",
        Effect: "Allow",
        Action: [
          "sso:ListDirectoryAssociations*",
          "identitystore:DescribeUser",
        ],
        Resource: "*",
      },
      {
        Sid: "EC2",
        Effect: "Allow",
        Action: ["ec2:DescribeInstances"],
        Resource: "*",
      },
      {
        Sid: "EC22",
        Effect: "Allow",
        Action: ["ec2:GetPasswordData"],
        Resource: "*",
        Condition: {
          StringEquals: {
            "aws:ResourceTag/security:bastion": "true",
          },
        },
      },
      {
        Sid: "SSM",
        Effect: "Allow",
        Action: [
          "ssm:DescribeInstanceProperties",
          "ssm:GetCommandInvocation",
          "ssm:GetInventorySchema",
        ],
        Resource: "*",
      },
      {
        Sid: "TerminateSession",
        Effect: "Allow",
        Action: ["ssm:TerminateSession"],
        Resource: "*",
        Condition: {
          StringLike: {
            "ssm:resourceTag/aws:ssmmessages:session-id": ["${aws:userName}"],
          },
        },
      },
      {
        Sid: "SSMGetDocument",
        Effect: "Allow",
        Action: ["ssm:GetDocument"],
        Resource: [
          "arn:aws:ssm:*:*:document/AWS-StartPortForwardingSession",
          "arn:aws:ssm:*:*:document/SSM-SessionManagerRunShell",
        ],
      },
      {
        Sid: "SSMStartSession",
        Effect: "Allow",
        Action: ["ssm:StartSession"],
        Resource: [
          "arn:aws:ssm:*:*:managed-instance/*",
          "arn:aws:ssm:*:*:document/AWS-StartPortForwardingSession",
        ],
        Condition: {
          BoolIfExists: {
            "ssm:SessionDocumentAccessCheck": "true",
          },
        },
      },
      {
        Sid: "SSMStartSession2",
        Effect: "Allow",
        Action: ["ssm:StartSession"],
        Resource: ["arn:aws:ec2:*:*:instance/*"],
        Condition: {
          StringEquals: {
            "aws:ResourceTag/security:bastion": "true",
          },
        },
      },
      {
        Sid: "SSMSendCommand",
        Effect: "Allow",
        Action: ["ssm:SendCommand"],
        Resource: [
          "arn:aws:ssm:*:*:managed-instance/*",
          "arn:aws:ssm:*:*:document/AWSSSO-CreateSSOUser",
        ],
        Condition: {
          BoolIfExists: {
            "ssm:SessionDocumentAccessCheck": "true",
          },
        },
      },
      {
        Sid: "SSMSendCommand2",
        Effect: "Allow",
        Action: ["ssm:SendCommand"],
        Resource: ["arn:aws:ec2:*:*:instance/*"],
        Condition: {
          StringEquals: {
            "aws:ResourceTag/security:bastion": "true",
          },
        },
      },
      {
        Sid: "GuiConnect",
        Effect: "Allow",
        Action: [
          "ssm-guiconnect:CancelConnection",
          "ssm-guiconnect:GetConnection",
          "ssm-guiconnect:StartConnection",
        ],
        Resource: "*",
      },
    ],
  };
}
