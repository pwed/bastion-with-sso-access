import { aws_iam, aws_sso, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";

interface BastionSsoStackProps extends StackProps {
  ssoInstanceArn: string;
  targetAccounts?: string[];
  userGuids?: string[];
  groupGuids?: string[];
  permissionSetName?: string;
  sessionDuration?: string;
  securityTagKey?: string;
  securityTagValue?: string;
}

export class BastionSsoStack extends Stack {
  securityTagKey: string;
  securityTagValue: string;

  constructor(scope: Construct, id: string, props: BastionSsoStackProps) {
    super(scope, id, props);

    const securityTagKey = props.securityTagKey
      ? props.securityTagKey
      : "security:bastion";
    const securityTagValue = props.securityTagValue
      ? props.securityTagValue
      : "true";
    this.securityTagKey = securityTagKey;
    this.securityTagValue = securityTagValue;

    const ssoInstanceArn: string = props.ssoInstanceArn;

    const permissionSet = new aws_sso.CfnPermissionSet(
      this,
      "BastionAccessPermissionSet",
      {
        instanceArn: ssoInstanceArn,
        inlinePolicy: getPermissionSet(securityTagKey, securityTagValue),
        name: props.permissionSetName
          ? props.permissionSetName
          : "BastionAccess",
        sessionDuration: props.sessionDuration ? props.sessionDuration : "PT8H",
        relayStateType:
          "https://console.aws.amazon.com/systems-manager/managed-instances/rdp-connect",
      }
    );

    const userGuids = props.userGuids;
    const groupGuids = props.groupGuids;
    const accounts = props.targetAccounts;
    if (accounts) {
      accounts.forEach((a) => {
        if (userGuids) {
          userGuids.forEach((u) => {
            new aws_sso.CfnAssignment(this, `Account${a}User${u}`, {
              permissionSetArn: permissionSet
                .getAtt("PermissionSetArn")
                .toString(),
              principalType: "USER",
              principalId: u,
              instanceArn: ssoInstanceArn,
              targetType: "AWS_ACCOUNT",
              targetId: a,
            });
          });
        }
        if (groupGuids) {
          groupGuids.forEach((g) => {
            new aws_sso.CfnAssignment(this, `Account${a}Group${g}`, {
              permissionSetArn: permissionSet
                .getAtt("PermissionSetArn")
                .toString(),
              principalType: "GROUP",
              principalId: g,
              instanceArn: ssoInstanceArn,
              targetType: "AWS_ACCOUNT",
              targetId: a,
            });
          });
        }
      });
    }
  }
}

function getPermissionSet(
  tagKey: string,
  tagValue: string
): aws_iam.PolicyDocument {
  return new aws_iam.PolicyDocument({
    statements: [
      new aws_iam.PolicyStatement({
        effect: aws_iam.Effect.ALLOW,
        actions: [
          "cloudwatch:DescribeAlarms",
          "ec2:DescribeInstances",
          "ec2:DescribeInstanceStatus",
          "ec2:DescribeSecurityGroup*",
          "identitystore:DescribeUser",
          "ssm-guiconnect:CancelConnection",
          "ssm-guiconnect:GetConnection",
          "ssm-guiconnect:StartConnection",
          "ssm:DescribeInstance*",
          "ssm:GetCommandInvocation",
          "ssm:GetInventorySchema",
          "sso:ListDirectoryAssociations*",
          "rds:Describe*",
          "secretsmanager:ListSecrets",
          "kms:ListAliases",
        ],
        resources: ["*"],
      }),
      new aws_iam.PolicyStatement({
        effect: aws_iam.Effect.ALLOW,
        actions: [
          "ec2:GetPasswordData",
          "ec2:StartInstances",
          "ssm:GetConnectionStatus",
          "ssm:SendCommand",
          "ssm:StartSession",
        ],
        resources: ["arn:aws:ec2:*:*:instance/*"],
        conditions: {
          StringEquals: JSON.parse(
            `{"aws:ResourceTag/${tagKey}": "${tagValue}"}`
          ),
        },
      }),
      new aws_iam.PolicyStatement({
        effect: aws_iam.Effect.ALLOW,
        actions: [
          "secretsmanager:DescribeSecret",
          "secretsmanager:GetSecretValue",
        ],
        resources: ["*"],
        conditions: {
          StringEquals: JSON.parse(
            `{"aws:ResourceTag/${tagKey}": "${tagValue}"}`
          ),
        },
      }),
      new aws_iam.PolicyStatement({
        effect: aws_iam.Effect.ALLOW,
        actions: ["ssm:TerminateSession"],
        resources: ["*"],
        conditions: {
          StringLike: {
            "ssm:resourceTag/aws:ssmmessages:session-id": "${aws:userName}",
          },
        },
      }),
      new aws_iam.PolicyStatement({
        effect: aws_iam.Effect.ALLOW,
        actions: ["ssm:GetDocument"],
        resources: [
          "arn:aws:ssm:*:*:document/AWS-StartPortForwardingSession",
          "arn:aws:ssm:*:*:document/SSM-SessionManagerRunShell",
        ],
      }),
      new aws_iam.PolicyStatement({
        effect: aws_iam.Effect.ALLOW,
        actions: ["ssm:SendCommand", "ssm:StartSession"],
        resources: [
          "arn:aws:ssm:*:*:document/AWS-StartPortForwardingSession",
          "arn:aws:ssm:*:*:document/AWSSSO-CreateSSOUser",
          "arn:aws:ssm:*:*:managed-instance/*",
        ],
        conditions: {
          BoolIfExists: {
            "ssm:SessionDocumentAccessCheck": "true",
          },
        },
      }),
    ],
  });
}
