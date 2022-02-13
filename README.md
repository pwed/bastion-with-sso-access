# Windows bastion with AWS SSO access

This project contains several reference stacks to show how to integrate RDP access through AWS SSO using SSM GuiConnect. By using Fleet Manager to connect to Windows instnaces we do not have to expose RDP access externally and the connection is tunneled through a SSM connection (similar to an SSH tunnel).

## Examples in this project

- AWS SSO Permission set with resource access locked down through the use of tag conditions
- Windows EC2 instance with access RDP access through SSO GuiConnect
- RDS instance with secret that the SSO user can access to connect with something like MySQL Workbench from the Windows instance.
- Maintanence window automation to stop the Windows instance each night to save costs

## Screenshot

![Screenshot](docs/FleetManager.png)

## TODO

- Create IAM policy for when SSO isn't available
 - There is already a key to log in as Administrator stored in Secrets Manager