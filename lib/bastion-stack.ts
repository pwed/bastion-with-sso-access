import { aws_ec2, aws_iam, Stack, StackProps, Tags } from "aws-cdk-lib";
import { Construct } from "constructs";
import { KeyPair } from 'cdk-ec2-key-pair';

interface BastionStackProps extends StackProps {
  securityTagKey?: string;
  securityTagValue?: string;
  securityGroups?: aws_ec2.SecurityGroup[];
}

export class BastionStack extends Stack {
  constructor(scope: Construct, id: string, props?: BastionStackProps) {
    super(scope, id, props);

    const securityTagKey = props?.securityTagKey
      ? props.securityTagKey
      : "security:bastion";
    const securityTagValue = props?.securityTagValue
      ? props.securityTagValue
      : "true";

    const key = new KeyPair(this, "key", {
      name: "bastion-key",
      storePublicKey: false,
    })
    Tags.of(key).add(securityTagKey, securityTagValue)

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
      keyName: key.keyPairName
    });
    if (props?.securityGroups) {
      props.securityGroups.forEach((s) => {
        bastionInstance.addSecurityGroup(s);
      });
    }

    Tags.of(bastionInstance.instance).add(securityTagKey, securityTagValue);

    bastionInstance.role.addManagedPolicy(
      aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
        "AmazonSSMManagedInstanceCore"
      )
    );
  }
}
