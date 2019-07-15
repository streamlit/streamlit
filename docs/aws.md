# Streamlit on Docker on EC2

Short term instructions on getting streamlit report running on AWS via
docker.

## Use VPN

### Install OpenVPN
```
$ brew install openvpn
```

### Getting VPN Access
See [#add-vpn-user](#add-vpn-user)

### Connect via OpenVPN
```
$ sudo /usr/local/sbin/openvpn --config /path/to/user.ovpn
```

### Test

#### Verifying external connectvity does not go through VPN

Make sure you can connect to the internet directly and NOT through the
VPN. [Check](http://whatismyip.host/my-ip-address-details) that your public IP
is your ISP, like Comcast, and not Amazon.  If that link
doesn't work then ask [Google](https://www.google.com/search?q=what+is+my+ip+address) for your IP address.


#### Verify Networking goes through VPN

Go the portainer page.
[http://aws02.streamlit.io:9000](http://aws02.streamlit.io:9000)


## Launch on AWS

### Get SSH access to run the commands
[#add-other-peoples-ssh-key](#add-other-peoples-ssh-key)

### Create SSH Tunnel
Foreground
* `ssh ubuntu@aws02.streamlit.io -L127.0.0.1:2374:/var/run/docker.sock`

Background
* `ssh ubuntu@aws02.streamlit.io -L127.0.0.1:2374:/var/run/docker.sock -fN`

### Login to dockerhub
```
$ docker login
```

### Build images
```
$ (cd docker; make build)
```
Look for your image [https://cloud.docker.com/u/streamlit/repository/docker/streamlit/streamlit](https://cloud.docker.com/u/streamlit/repository/docker/streamlit/streamlit)

### Push images
```
$ (cd docker; make push)
```

### Run containers in AWS
```
$ export DOCKER_HOST=tcp://127.0.0.1:2374
$ (cd docker; make aws)
```

You should see them here
[http://aws02.streamlit.io:9000/#/containers](http://aws02.streamlit.io:9000/#/containers)

Here are some examples:
* [images](http://aws02.streamlit.io:5600/)
* [reference](http://aws02.streamlit.io:5601/)
* [mnist](http://aws02.streamlit.io:5602/)

# ONLY FOR SETUP
Only read this if you want to know how the magic was setup.

## Setup AWS
Setup and verify your AWS credentials.
```
$ export AWS_PROFILE=armando@streamlit
$ aws sts get-caller-identity
{
    "UserId": "AIDAIUV4YZQR5IH5XQR5Y",
    "Account": "756547529563",
    "Arn": "arn:aws:iam::756547529563:user/armando"
}
```

## Setup VPC
* Generate cloud formation templates.
```
$ python scripts/create_vpc.py
```

* Use cloudformation to create VPC
```
$ aws cloudformation create-stack --stack-name streamlit-vpc-prod --template-body file://configs/autogen/vpc.yaml --parameters=file://configs/vpc.json
```

If you make changes to cloudformation files.
```
$ aws cloudformation update-stack --stack-name streamlit-vpc-prod --template-body file://configs/autogen/vpc.yaml --parameters=file://configs/vpc.json
```

## Setup VPN
### Get IP address of bastion host to configure and turn into VPN server.
```
$ aws cloudformation describe-stacks --stack-name streamlit-vpc-prod | jq -r '.Stacks[] | select(.StackName | contains("streamlit-vpc-prod")) | .Outputs[] | select(.OutputKey | contains("BastionIP")) | .OutputValue'
```

### Update DNS by editing json file
* Add IP From above to vpn.streamlit.io [../docker/aws/route53.json](./docker/aws/route53.json)

### Update route53.
```
$ aws route53 change-resource-record-sets --hosted-zone-id Z3FVB88O4K9PQZ --change-batch file://route53.json
```

### SSH into bastion host.
```
$ ssh ec2-user@vpn.streamlit.io
```

### Setup bastion host as "redhat"
AWS AMI isn't exactly redhat but vpn script looks for redhat-release
file so create it.
```
$ sudo touch /etc/redhat-release
```

### Download VPN Script
The vpn script from https://git.io/vpn cant be used because the AMI
image is too old so download an older version of the script.
```
$ curl -O https://raw.githubusercontent.com/Nyr/openvpn-install/456fbf189d640bb2f735b6463ba98f34b92590eb/openvpn-install.sh
$ sudo mv openvpn-install.sh /usr/local/bin/vpn.sh
```

### Install OpenVPN
It will ask for some info:
* internal address - default internal address is fine.
* external address - enter the public ip address of the instance
* protocol - default of udp is fine.
* port - default of 1194 is fine.
* DNS - default is fine
* client certificate - the default is fine because when you rerun the
                       script you can specify another different user and
                       delete this default one.

```
Welcome to this OpenVPN "road warrior" installer!

I need to ask you a few questions before starting the setup.
You can leave the default options and just press enter if you are ok with them.

First, provide the IPv4 address of the network interface you want OpenVPN
listening to.
IP address: 172.19.250.12

This server is behind NAT. What is the public IPv4 address or hostname?
Public IP address / hostname: 54.186.178.159

Which protocol do you want for OpenVPN connections?
   1) UDP (recommended)
   2) TCP
Protocol [1-2]: 1

What port do you want OpenVPN listening to?
Port: 1194

Which DNS do you want to use with the VPN?
   1) Current system resolvers
   2) 1.1.1.1
   3) Google
   4) OpenDNS
   5) Verisign
DNS [1-5]: 3

Finally, tell me your name for the client certificate.
Please, use one word only, no special characters.
Client name: client

Okay, that was all I needed. We are ready to set up your OpenVPN server now.
Press any key to continue...
```

### Modify OpenVPN Server to split routing configuration
After installation, the server is configured to route all your traffic
through the internet which isn't ideal.  In order to only route the vm
traffic you need to make some changes.

`172.19.0.0/16` is the AWS network for our region, it might be different in the future.

```
$ sudo sed -i -e 's/push "redirect-gateway def1 bypass-dhcp"/push "route 172.19.0.0 255.255.0.0"/g' /etc/openvpn/server/server.conf
$ sudo /etc/init.d/openvpn restart
```

### Remove Default (client) user
```
Looks like OpenVPN is already installed.

What do you want to do?
   1) Add a new user
   2) Revoke an existing user
   3) Remove OpenVPN
   4) Exit
Select an option [1-4]: 2

Select the existing client certificate you want to revoke:
     1) client
Select one client [1]:

Do you really want to revoke access for client client? [y/N]: y
Using configuration from ./safessl-easyrsa.cnf
Can't load /etc/openvpn/server/easy-rsa/pki/.rnd into RNG
139916877595072:error:2406F079:random number generator:RAND_load_file:Cannot open file:../crypto/rand/randfile.c:88:Filename=/etc/openvpn/server/easy-rsa/pki/.rnd
Revoking Certificate EC759C2FF143ADA5268B6D8803008074.
Data Base Updated

Using SSL: openssl OpenSSL 1.1.1  11 Sep 2018
Using configuration from ./safessl-easyrsa.cnf
Can't load /etc/openvpn/server/easy-rsa/pki/.rnd into RNG
139880418361792:error:2406F079:random number generator:RAND_load_file:Cannot open file:../crypto/rand/randfile.c:88:Filename=/etc/openvpn/server/easy-rsa/pki/.rnd

An updated CRL has been created.
CRL file: /etc/openvpn/server/easy-rsa/pki/crl.pem


Certificate for client client revoked!
```

### Manually Add UDP 1194 to streamlit_prod_public security group

### Add VPN User.
@aaj-st, @tvst, @treuille have access via `ec2-user@vpn.streamlit.io:~/.ssh/authorized_keys` and they're the ones that need to run this command.

```
$ ssh ec2-user@vpn.streamlit.io
Last login: Wed Jul 10 22:27:24 2019 from c-76-126-140-41.hsd1.ca.comcast.net

       __|  __|_  )
       _|  (     /   Amazon Linux AMI
      ___|\___|___|

[ec2-user@ip-172-19-250-12 ~]$ sudo /usr/local/bin/vpn.sh

Looks like OpenVPN is already installed.

What do you want to do?
   1) Add a new user
   2) Revoke an existing user
   3) Remove OpenVPN
   4) Exit
Select an option [1-4]: 1

Tell me a name for the client certificate.
Please, use one word only, no special characters.
Client name: armando

Using SSL: openssl OpenSSL 1.1.1  11 Sep 2018
Can't load /etc/openvpn/server/easy-rsa/pki/.rnd into RNG
140405015073216:error:2406F079:random number generator:RAND_load_file:Cannot open file:../crypto/rand/randfile.c:88:Filename=/etc/openvpn/server/easy-rsa/pki/.rnd
Generating a RSA private key
..............................+++++
...........................................................................+++++
writing new private key to '/etc/openvpn/server/easy-rsa/pki/private/armando.key.k2rMpTlfNU'
-----
Using configuration from ./safessl-easyrsa.cnf
Can't load /etc/openvpn/server/easy-rsa/pki/.rnd into RNG
140663683592640:error:2406F079:random number generator:RAND_load_file:Cannot open file:../crypto/rand/randfile.c:88:Filename=/etc/openvpn/server/easy-rsa/pki/.rnd
Check that the request matches the signature
Signature ok
The Subject's Distinguished Name is as follows
commonName            :ASN.1 12:'armando'
Certificate is to be certified until Jun 10 20:04:47 2029 GMT (3650 days)

Write out database with 1 new entries
Data Base Updated

Client armando added, configuration is available at: /home/armando/armando.ovpn
```

### Copy the generated OpenVPN configuration/certificate to your computer.

Since the previous step created armando.ovpn thats what you use in the scp line to copy over.

```
$ scp ec2-user@vpn.streamlit.io:/root/armando.ovpn ~/Downloads/
armando.ovpn                                         100% 4994   124.0KB/s   00:00
```

Now via slack or email, send this that file to the user.

## Setup Docker on an EC2 Instance.
This assumes you VPN'd in and uses the built in docker-machine command
to setup an EC2 instance and magically install docker on it.

### Create docker ec2 instance
```
docker-machine create --driver amazonec2 --amazonec2-vpc-id vpc-04993f38a83626700  --amazonec2-private-address-only --amazonec2-instance-type p2.xlarge --amazonec2-region us-west-2 --amazonec2-zone a --amazonec2-subnet-id subnet-0e23cdaae8b358487 --amazonec2-ami ami-07b4f3c02c7f83d59 --amazonec2-root-size 100 --amazonec2-security-group streamlit_prod_private aws01
```

### GPU Setup (only for swarm nodes that have a gpu)

Unsorted notes.
```
https://github.com/NVIDIA/nvidia-docker
nvidia-384
https://marmelab.com/blog/2018/03/21/using-nvidia-gpu-within-docker-container.html
https://github.com/NVIDIA/nvidia-docker
https://github.com/NVIDIA/nvidia-docker/wiki/CUDA
https://hub.docker.com/r/nvidia/cuda/
https://github.com/nvidia/nvidia-docker/wiki/Installation-(version-2.0)
https://www.nvidia.com/object/linux-amd64-display-archive.html
```

### Add other people's SSH key
The issue with this command is that it pairs the person who runs that
command with that machine ie the certs generated only live on that
persons computer which makes other people connecting to this machine
difficult.  So after create, its up to the person who created that
machine to add his/her SSH key and others to that machine manually so
other people can SSH in ie add key to ~/.ssh/authorized_keys.

user who wants access
```
$ cat ~/.ssh/id_rsa.pub | pbcopy
```
Send key via cut and paste to @aaj-st, @tvst, @treuille via slack/email

admin
```
echo '<PASTE>'  >> ~ubuntu/.ssh/authorized_ke
```


### Add user ubuntu to docker
This is needed so ubuntu users can run commands with out sudo

```
docker-machine ssh aws01 sudo usermod -aG docker ubuntu
```

### Add docker-machine's internal IP to DNS

* Get ip via `docker-machine ip aws01`
* Add it to route53.json
* run
```
aws route53 change-resource-record-sets --hosted-zone-id Z3FVB88O4K9PQZ --change-batch file://route53.json
```

### Manually add security groups

Add streamlit_prod_private security group to aws01 ec2 instance
