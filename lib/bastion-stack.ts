import { aws_ec2, aws_iam, Stack, StackProps, Tags } from "aws-cdk-lib";
import { Construct } from "constructs";
// import { KeyPair } from "cdk-ec2-key-pair";
import { bastion } from "pwed-cdk";

interface BastionStackProps extends StackProps {
  securityTagKey?: string;
  securityTagValue?: string;
  createKeyPair?: boolean;
}

export class BastionStack extends Stack {
  securityGroup: aws_ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props?: BastionStackProps) {
    super(scope, id, props);

    const vpc = aws_ec2.Vpc.fromLookup(this, "default", {
      isDefault: true,
    });

    const wb = new bastion.WindowsBastion(this, "WindowsBastion", {
      vpc,
      vpcSubnets: vpc.selectSubnets({
        subnetType: aws_ec2.SubnetType.PUBLIC,
      }),
      windowsPackages: [
        // packages to install with WinGet
        "Amazon.AWSCLI",
        "Amazon.SessionManagerPlugin",
        "Docker.DockerDesktop",
        "Google.Chrome",
        "Microsoft.Powershell",
        "Microsoft.VisualStudioCode",
        "Microsoft.WindowsTerminal",
        "Oracle.MySql",
        "PostgresSQL.pgAdmin",
      ]
    });

    this.securityGroup = wb.securityGroup

  }
}
