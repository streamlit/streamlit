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
        self.setup_security_group()
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
                Default='t2.medium',
                # There should be more listed here.
                AllowedValues=[
                    't2.nano',
                    't2.micro',
                    't2.small',
                    't2.medium',
                    't2.large',
                    't2.xlarge',
                    't2.2xlarge',
                    'm4.large',
                    'c4.large',
                    'r3.large',
                    'p2.xlarge'
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
            'VpcId': Parameter(
                'VpcId',
                Description='VPC ID to use',
                Type='AWS::EC2::VPC::Id',
            ),
            'SubnetId': Parameter(
                'SubnetId',
                Description='Subnet ID to use',
                Type='AWS::EC2::Subnet::Id',
            ),
        })

    def setup_security_group(self):
        self._resources.update({
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
                VpcId=Ref(self._parameters['VpcId']),
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
                        SubnetId=Ref(self._parameters['SubnetId']),
                    ),
                ],
                UserData=Base64(Join(
                    '',
                    [
                        '#!/bin/bash\n',
                        # Add a temporary /usr/local/bin/streamlit so
                        # user knows its still installing.
                        'echo -e \'#!/bin/sh\necho Streamlit is still installing. Please try again in a few minutes.\n\' > /usr/local/bin/streamlit \n',
                        'chmod +x /usr/local/bin/streamlit \n',
                        # Create ~/sshfs dir which is the target of the sshfs mount commmand
                        'install -o ubuntu -g ubuntu -m 755 -d ~ubuntu/sshfs \n',
                        # Install streamlit.
                        '/home/ubuntu/anaconda3/bin/pip install streamlit \n',
                        # Install rmate.
                        'curl -o /usr/local/bin/rmate https://raw.githubusercontent.com/aurora/rmate/master/rmate \n',
                        'chmod +x /usr/local/bin/rmate \n',
                        # After streamlit is installed, remove the
                        # temporary script and add a link to point to
                        # streamlit in the anaconda directory.  This is
                        # needed so we dont have to make the user to
                        # `rehash` in order to pick up the new location.
                        'rm -f /usr/local/bin/streamlit \n',
                        'ln -fs /home/ubuntu/anaconda3/bin/streamlit /usr/local/bin/streamlit \n',
                        # Get streamlit config which has the proxy wait
                        # for 2 minutes and any other options we added.
                        'curl -o /tmp/config.toml http://streamlit.io/cf/config.toml \n',
                        'install -D -m 755 -o ubuntu -t ~ubuntu/.streamlit /tmp/config.toml \n',
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
        for k in sorted(self._parameters.keys()):
            value = self._parameters.get(k).properties.get('Default')
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

        data = json.dumps(p, indent=4, sort_keys=True, separators=(',', ': '))

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
