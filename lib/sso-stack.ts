import { aws_sso, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";

interface BastionSsoStackProps extends StackProps {
  ssoInstanceArn: string;
  targetAccounts?: string[];
  userGuids?: string[];
  groupGuids?: string[];
  sessionDuration?: string;
}

export class BastionSsoStack extends Stack {
  constructor(scope: Construct, id: string, props: BastionSsoStackProps) {
    super(scope, id, props);

    const ssoInstanceArn: string = props.ssoInstanceArn;

    const permissionSet = new aws_sso.CfnPermissionSet(
      this,
      "BastionAccessPermissionSet",
      {
        instanceArn: ssoInstanceArn,
        inlinePolicy: getPermissionSet(),
        name: "BastionAccess",
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
