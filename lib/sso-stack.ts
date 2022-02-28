import { aws_iam, aws_sso, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { pwed_bastion } from "pwed-cdk";

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

interface principal {
  id: string;
  type: string;
}

export class BastionSsoStack extends Stack {
  securityTagKey: string;
  securityTagValue: string;

  constructor(scope: Construct, id: string, props: BastionSsoStackProps) {
    super(scope, id, props);

    const ssoInstanceArn: string = props.ssoInstanceArn;

    const permissionSet = new pwed_bastion.BastionPermissionSet(
      this,
      "BastionAccessPermissionSet",
      {
        ssoInstanceArn,
        permissionSetName: props.permissionSetName
          ? props.permissionSetName
          : "BastionAccessRole",
      }
    );

    const userGuids = props.userGuids ? props.userGuids : [];
    const groupGuids = props.groupGuids ? props.groupGuids : [];
    const accounts = props.targetAccounts;
    let principals: principal[] = [
      ...userGuids.map((u) => {
        return { id: u, type: "USER" };
      }),
      ...groupGuids.map((g) => {
        return { id: g, type: "GROUP" };
      })
    ]
    if (accounts) 
      accounts.forEach((account) => {
        if (userGuids) {
          principals.forEach((principal) => {
            permissionSet.assign(account, principal.id, principal.type);
          });
        }
      });
    
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
