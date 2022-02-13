import {
  aws_ec2,
  aws_rds,
  aws_secretsmanager,
  Duration,
  Stack,
  StackProps,
  Tags,
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface RdsStackProps extends StackProps {
  securityTagKey?: string;
  securityTagValue?: string;
}

export class RdsStack extends Stack {
  rdsAccessSecurityGroup: aws_ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: RdsStackProps) {
    super(scope, id, props);

    const securityTagKey = props?.securityTagKey
      ? props.securityTagKey
      : "security:bastion";
    const securityTagValue = props?.securityTagValue
      ? props.securityTagValue
      : "true";

    const vpc = aws_ec2.Vpc.fromLookup(this, "DefaultVpc", { isDefault: true });

    this.rdsAccessSecurityGroup = new aws_ec2.SecurityGroup(
      this,
      "RdsAccessSg",
      {
        vpc,
        allowAllOutbound: true,
      }
    );

    const rdsSecurityGroup = new aws_ec2.SecurityGroup(this, "RdsSg", {
      vpc,
      allowAllOutbound: false,
    });

    const secret = new aws_secretsmanager.Secret(this, "RdsSecret", {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "admin" }),
        generateStringKey: "password",
        excludeCharacters: '/@"s',
      },
    });

    Tags.of(secret).add(securityTagKey, securityTagValue);

    const rdsInstance = new aws_rds.ServerlessCluster(this, "Cluster", {
      vpc,
      vpcSubnets: { subnetType: aws_ec2.SubnetType.PUBLIC },
      engine: aws_rds.DatabaseClusterEngine.auroraMysql({
        version: aws_rds.AuroraMysqlEngineVersion.VER_5_7_12,
      }),
      securityGroups: [rdsSecurityGroup],
      scaling: {
        minCapacity: 1,
        autoPause: Duration.minutes(30),
      },
      credentials: {
        username: "admin",
        secret,
        password: secret.secretValueFromJson("password"),
      },
    });

    rdsSecurityGroup.addIngressRule(
      this.rdsAccessSecurityGroup,
      new aws_ec2.Port({
        protocol: aws_ec2.Protocol.TCP,
        fromPort: rdsInstance.clusterEndpoint.port,
        toPort: rdsInstance.clusterEndpoint.port,
        stringRepresentation: "MySQL",
      })
    );
  }
}
