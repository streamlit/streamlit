"""Create streamlit cloudformation template.

This originally came from https://github.com/cloudtools/troposphere/blob/master/examples/VPC_single_instance_in_subnet.py

Usage:
* Run script
* Go to https://console.aws.amazon.com/cloudformation
  * Click on `Create Stack` and load `configs/autogen/insight.yaml`
  * Follow instructions on the web console.
* Or you can do it from the command line via.
   ```
   $ aws cloudformation create-stack --stack-name ${USER}-insight --template-body file://configs/autogen/insight.yaml --parameters=file://configs/autogen/insight_parameters.json
   ```
"""

import json
import logging
import textwrap
import time
import os

import troposphere.ec2 as ec2

from troposphere import (Base64, Equals, FindInMap, GetAtt, Join, Or, Output, Parameter,
                         Ref, Select, Split, Sub, Tags, Template)

logging.Formatter.converter = time.gmtime
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s.%(msecs)03d %(levelname)s:%(name)s:%(message)s',
    datefmt='%Y-%m-%dT%H:%M:%SZ')


class Insight(object):
    def __init__(self):
        self._name = 'insight'
        self._stack_id = Ref('AWS::StackId')
        self._stack_name = Ref('AWS::StackName')
        self._region = Ref('AWS::Region')
        self._t = Template()
        self._parameters = {}
        self._conditions = {}
        self._resources = {}
        self._outputs = {}

        self._t.add_description(textwrap.dedent('''
            Streamlit cloud formation template to create a single EC2 instance in a new VPC.
            **WARNING** This template creates an Amazon EC2 instance. You will be billed
            for the AWS resources used if you create a stack from this template.
        '''))

        # Order matters
        self.setup_parameters()
        self.add_ami_mappings()
        self.create_vpc()
        self.setup_network()
        self.add_ec2_instance()
        self.create()

    def add_ami_mappings(self):
        """Get  the Deep Learning AMI for every region

        TODO(armando): automate the fetching of AMIs.

        The following command was based on these two urls.
        * https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/finding-an-ami.html
        * https://docs.aws.amazon.com/cli/latest/reference/ec2/describe-images.html

        $ AWS_DEFAULT_REGION=us-west-2 aws ec2 describe-images \
            --filters 'Name=description,Values=*Keras*' \
                      'Name=owner-alias,Values=amazon' \
                      'Name=state,Values=available' \
                      'Name=name,Values=*Ubuntu*' --output json \
            | jq -r '.Images | sort_by(.CreationDate) | .[-5:] | .[] \
                             | {Name, ImageId, Description, CreationDate}'

        Latest version is 'Deep Learning AMI (Ubuntu) Version 20.0' @ 2018-12-12T02:40:21.000Z
        """
        self._t.add_mapping('RegionMap', {
            'us-east-1': {'AMI': 'ami-0f9e8c4a1305ecd22'},
            'us-west-1': {'AMI': 'ami-01eeae51446aeffdb'},
            'us-west-2': {'AMI': 'ami-0d0ff0945ae093aea'},
            # 'us-west-2': {'AMI': 'ami-0bbe6b35405ecebdb'},
            'eu-west-1': {'AMI': 'ami-0827ddd2d8e38aa56'},
            'sa-east-1': {'AMI': 'ami-0a28b3352c3479371'},
            'ap-southeast-1': {'AMI': 'ami-09dfb1478dc499b95'},
            'ap-northeast-1': {'AMI': 'ami-031ce7af929321d3a'}
        })

    def setup_parameters(self):
        self._parameters.update({
            'Ec2InstanceType': Parameter(
                'Ec2InstanceType',
                Type='String',
                Description='EC2 Instance Type',
                Default='t3.medium',
                # There should be more listed here.
                AllowedValues=[
                    't3.medium', 'p2.xlarge',
                ],
                ConstraintDescription='Must be a valid EC2 instance type.',
            ),
            'SshKeyName': Parameter(
                'SshKeyName',
                ConstraintDescription='Must be the name of an existing EC2 KeyPair.',
                Description='Name of an existing EC2 KeyPair to enable SSH access to the instance',
                Type='AWS::EC2::KeyPair::KeyName',
            ),
            'SshLocation': Parameter(
                'SshLocation',
                Description=' The IP address range that can be used to SSH to the EC2 instances',
                Type='String',
                MinLength='9',
                MaxLength='18',
                Default='0.0.0.0/0',
                AllowedPattern=r"(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})/(\d{1,2})",
                ConstraintDescription=(
                    "must be a valid IP CIDR range of the form x.x.x.x/x."),
            ),
        })

    def create_vpc(self):
        self._resources.update({
            'VPC': ec2.VPC(
                'VPC',
                CidrBlock='172.17.0.0/16',
                Tags=Tags(
                    Application=self._stack_id,
                    Name=Sub('Streamlit VPC (${AWS::StackName})'),
                ),
            ),
        }) 

        self._resources.update({
            'Subnet': ec2.Subnet(
                'Subnet',
                CidrBlock='172.17.255.0/24',
                VpcId=Ref(self._resources['VPC']),
                Tags=Tags(
                    Application=self._stack_id,
                    Name=Sub('Streamlit Subnet (${AWS::StackName})'),
                ),
            ),
            'InternetGateway': ec2.InternetGateway(
                'InternetGateway',
                Tags=Tags(
                    Application=self._stack_id,
                    Name=Sub('Streamlit InternetGateway (${AWS::StackName})'),
                ),
            ),
            'RouteTable': ec2.RouteTable(
                'RouteTable',
                VpcId=Ref(self._resources['VPC']),
                Tags=Tags(
                    Application=self._stack_id,
                    Name=Sub('Streamlit RouteTable (${AWS::StackName})'),
                ),
            ),
        }) 

        self._resources.update({
            'VPCGatewayAttachment': ec2.VPCGatewayAttachment(
                'VPCGatewayAttachment',
                VpcId=Ref(self._resources['VPC']),
                InternetGatewayId=Ref(self._resources['InternetGateway']),
            ),
            'Route': ec2.Route(
                'Route',
                DependsOn='VPCGatewayAttachment',
                GatewayId=Ref(self._resources['InternetGateway']),
                DestinationCidrBlock='0.0.0.0/0',
                RouteTableId=Ref(self._resources['RouteTable']),
            ),
            'SubnetRouteTableAssociation': ec2.SubnetRouteTableAssociation(
                'SubnetRouteTableAssociation',
                SubnetId=Ref(self._resources['Subnet']),
                RouteTableId=Ref(self._resources['RouteTable']),
            ),
        }) 


    def setup_network(self):
        self._resources.update({
            'NetworkAcl': ec2.NetworkAcl(
                'NetworkAcl',
                VpcId=Ref(self._resources['VPC']),
                Tags=Tags(
                    Application=self._stack_id,
                    Name=Sub('Streamlit Network ACL (${AWS::StackName})'),
                ),
            ),
        }) 

        self._resources.update({
            'InboundAllNetworkAclEntry': ec2.NetworkAclEntry(
                'InboundAllNetworkAclEntry',
                NetworkAclId=Ref(self._resources['NetworkAcl']),
                RuleNumber='100',
                Protocol='-1',
                Egress='false',
                RuleAction='allow',
                CidrBlock='0.0.0.0/0',
            ),
            'OutBoundAllNetworkAclEntry': ec2.NetworkAclEntry(
                'OutBoundAllNetworkAclEntry',
                NetworkAclId=Ref(self._resources['NetworkAcl']),
                RuleNumber='100',
                Protocol='-1',
                Egress='true',
                RuleAction='allow',
                CidrBlock='0.0.0.0/0',
            ),
        }) 

        self._resources.update({
            'SubnetNetworkAclAssociation': ec2.SubnetNetworkAclAssociation(
                'SubnetNetworkAclAssociation',
                SubnetId=Ref(self._resources['Subnet']),
                NetworkAclId=Ref(self._resources['NetworkAcl']),
            ),
            'Ec2InstanceSecurityGroup': ec2.SecurityGroup(
                'Ec2InstanceSecurityGroup',
                GroupDescription='Enable Streamlit access via port 8501 and SSH access via port 22',
                SecurityGroupIngress=[
                    ec2.SecurityGroupRule(
                        IpProtocol='tcp',
                        FromPort='22',
                        ToPort='22',
                        CidrIp=Ref(self._parameters['SshLocation'])),
                    ec2.SecurityGroupRule(
                        IpProtocol='tcp',
                        FromPort='8501',
                        ToPort='8501',
                        CidrIp=Ref(self._parameters['SshLocation'])),
                ],
                VpcId=Ref(self._resources['VPC']),
                Tags=Tags(
                    Application=self._stack_id,
                    Name=Sub('Streamlit Security Group (${AWS::StackName})'),
                ),
            ),
        })





    def add_ec2_instance(self):
        self._resources.update({
            'Ec2Instance': ec2.Instance(
                'Ec2Instance',
                ImageId=FindInMap("RegionMap", Ref("AWS::Region"), "AMI"),
                InstanceType=Ref(self._parameters['Ec2InstanceType']),
                KeyName=Ref(self._parameters['SshKeyName']),
                NetworkInterfaces=[
                    ec2.NetworkInterfaceProperty(
                        GroupSet=[
                            Ref(self._resources['Ec2InstanceSecurityGroup']),
                        ],
                        AssociatePublicIpAddress='true',
                        DeviceIndex='0',
                        DeleteOnTermination='true',
                        SubnetId=Ref(self._resources['Subnet']),
                    ),
                ],        
                UserData=Base64(Join(
                    '',
                    [
                        '#!/bin/bash\n',
                        'echo "prepend domain-name-servers 8.8.8.8;" >> "/etc/dhcp/dhclient.conf"\n'
                        'service networking restart || true\n',
                        'sleep 5 \n',
                        '/home/ubuntu/anaconda2/bin/pip install streamlit \n',
                        '/home/ubuntu/anaconda3/bin/pip install streamlit \n',
                    ]
                )),
                Tags=Tags(
                    Application=self._stack_id,
                    Name=Sub('Streamlit EC2 Instance (${AWS::StackName})'),
                ),
            ),
        })

        self._resources.update({
            'IPAddress': ec2.EIP(
                'IPAddress',
                DependsOn='VPCGatewayAttachment',
                Domain='vpc',
                InstanceId=Ref(self._resources['Ec2Instance']),
            ),
        })

        self._outputs.update({
            'SshIp': Output(
                'SshIp',
                Description='SshIp',
                Value=GetAtt('Ec2Instance', 'PublicIp'),
            ),
            'SshCommand': Output(
                'SshCommand',
                Description='SshCommand',
                Value=Join('',
                    [
                        'ssh ubuntu@',
                        GetAtt('Ec2Instance', 'PublicIp'),
                    ]
                )
            ),
            'StreamlitEndpoint': Output(
                'StreamlitEndpoint',
                Description='Streamlit endpoint',
                Value=Join('',
                    [
                        GetAtt('Ec2Instance', 'PublicIp'),
                        ':8501',
                    ]
                )
            ),
        })

    def to_json(self):
        """Return cloudformation template in json."""
        return self._t.to_json()

    def to_yaml(self):
        """Return cloudformation template in yaml."""
        return self._t.to_yaml()

    def create(self):
        """Create the actual cloudformation template from python data structures."""
        for p in self._parameters.values():
            self._t.add_parameter(p)
        for c in self._conditions:
            self._t.add_condition(c, self._conditions[c])
        for r in self._resources.values():
            self._t.add_resource(r)
        for o in self._outputs.values():
            self._t.add_output(o)

    def write_file(self):
        """Write cloudformation template to file."""
        directory = os.path.dirname(__file__)
        config_path = os.path.join(directory, '../configs/autogen')
        print config_path
        if not os.path.exists(config_path):
            os.makedirs(config_path)
        yaml_file = os.path.abspath(os.path.join(
            config_path,
            '%s.yaml' % self._name))

        data = self.to_yaml()

        update = True
        try:
            with open(yaml_file, 'r') as f:
                if f.read() == data:
                    update = False
        except IOError:
            pass

        if update:
            with open(yaml_file, 'w') as f:
                f.write(data)
            logging.info('Wrote "%s"', yaml_file)
        else:
            logging.info('File "%s" did not change.', yaml_file)

    def write_parameters(self):
        # This is why its JSON and not yaml. https://github.com/aws/aws-cli/issues/2275
        p = []
        for k,v in self._parameters.iteritems():
            value = v.properties.get('Default')
            if not value: 
                value = ''
            p.append({
                'ParameterKey': k,
                'ParameterValue': value,
            })

        directory = os.path.dirname(__file__)
        config_path = os.path.join(directory, '../configs/autogen')
        if not os.path.exists(config_path):
            os.makedirs(config_path)
        json_file = os.path.abspath(os.path.join(
            config_path,
            '%s_parameters.json' % self._name))

        data = json.dumps(p, indent=4)

        update = True
        try:
            with open(json_file, 'r') as f:
                if f.read() == data:
                    update = False
        except IOError:
            pass

        if update:
            with open(json_file, 'w') as f:
                f.write(data)
            logging.info('Wrote "%s"', json_file)
        else:
            logging.info('File "%s" did not change.', json_file)


def main():
    """Run main function."""
    insight = Insight()
    insight.write_file()
    insight.write_parameters()


if __name__ == '__main__':
    main()
