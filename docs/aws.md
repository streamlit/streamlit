# Setting up AWS

These are instructions for use by streamlit developers.

There are two ways to use AWS.
* *Programmatic access* - Enables an access key ID and secret access key for the AWS API, CLI, SDK, and other development tools.
* *AWS Management [Console](https://streamlit.signin.aws.amazon.com/console) access* - Enables a password that allows users to sign-in to the AWS Management Console.

## Get AWS Console Access.
The initial user/password for the web console can be created by armando/adrien.

## Setup aws cli
Most things need programmtic access so you need to generate the keys.

Go to the [AWS IAM console](https://console.aws.amazon.com/iam/home#/home)
![aws_iam.png](images/aws_iam.png)

Click on Users then your user.   (Note that here I'm showing the Flotilla user, but you should click on _you_.)
![aws_iam_user.png](images/aws_iam_user.png)

Click on `Security credentials` tab
![aws_iam_security_creds.png](images/aws_iam_security_creds.png)

Click on `Create access key`
![aws_iam_access_key.png](images/aws_iam_access_key.png)

## Setup aws cli
```
pip install awscli
```

The aws cli tool is just called `aws`  I personally create an alias so I can switch between various AWS account using aws profiles which is included in aws cli.

### Configure a non default profile.
Note: These credentials aren't really mine.  Its mainly used as an example

```
$ aws --profile=streamlit configure
AWS Access Key ID [None]: AKIAI62YCGSR47V3CWGA
AWS Secret Access Key [None]: ElXhnrDGZXaXIPSSg6gCU2O+led65ayCeySKaa48
Default region name [None]: us-west-2
Default output format [None]:
```

All that really did is save the creds to a file.
```
$ cat ~/.aws/config
[profile streamlit]
region = us-west-2
```

```
$ cat ~/.aws/credentials
[streamlit]
aws_access_key_id = AKIAIIT4V7HIJCAHNYZQ
aws_secret_access_key = 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
```

So instead of doing a command line `aws s3 ls` you would do `aws --profile=streamlit s3 ls`

That will get tedious so lets make an alias.

### Create aws bash alias.
Add to `~/.bashrc` or `~/.bash_profile`
```
alias awst='aws --profile=streamlit'
```

Test it out.
```
$ awst s3 ls
2018-08-14 12:38:00 share.streamlit.io
2018-05-17 14:08:08 streamlit
```

### Alternatively you can use environment variables.
Since I dont have a default profile this won't work.
```
$ aws s3 ls
Unable to locate credentials. You can configure credentials by running "aws configure".
```

I can just set the profile
```
$ export AWS_PROFILE=streamlit
$ aws s3 ls
2018-08-14 12:38:00 share.streamlit.io
2018-05-17 14:08:08 streamlit
```

Or I can just set the access key id and secret access key
```
$ export AWS_SECRET_ACCESS_KEY=$(aws --profile streamlit configure get aws_secret_access_key)
$ export AWS_ACCESS_KEY_ID=$(aws --profile streamlit configure get aws_access_key_id)

$ env|grep AWS
AWS_SECRET_ACCESS_KEY=ElXhnrDGZXaXIPSSg6gCU2O+led65ayCeySKaa48
AWS_ACCESS_KEY_ID=AKIAI62YCGSR47V3CWGA

$ aws s3 ls
2018-08-14 12:37:59 share.streamlit.io
2018-05-17 14:08:08 streamlit
```

## Upload your SSH key.
### Generate an SSH Key
Github has a pretty good doc on creating SSH keys if you dont have one.
* [https://help.github.com/articles/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent/](https://help.github.com/articles/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent/)

### Import SSH key
```
$ aws ec2 import-key-pair --key-name "someuser" --public-key-material file://~/.ssh/someuser.pub
# I suggest
$ aws ec2 import-key-pair --key-name "user@streamlit" --public-key-material file://~/.ssh/someuser.pub
```
