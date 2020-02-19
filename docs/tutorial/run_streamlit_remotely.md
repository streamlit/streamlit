# Tutorial: Run Streamlit remotely

When you run Streamlit remotely you can still use your local web browser to
see the results. Be it on AWS, GCS, a Docker instance, or some other remote
machine, we got you covered! In this tutorial, we're going to show you how to
set up remote operation with AWS. The steps are similar for other services.

## Before we start

We assume that:

1. You have an EC2 instance up and running on AWS.
2. You know your AWS username, which we'll call `$USERNAME`. Often this is
   something like `ubuntu`, `admin` or `ec2-user`.
3. You know your instance's IP address, which we'll call `$IP_ADDRESS`. That's
   the "IPv4 Public IP" [from this page](https://console.aws.amazon.com/ec2/v2/home#Instances:sort=instanceId).
4. Your Streamlit code is already on the remote machine, in a file called
   `my_script.py`.

## SSH with port forwarding

To start with, let's SSH into your instance. But we won't just simply SSH.
Instead we'll turn on port-forwarding, so the Streamlit server on the remote
machine can be easily accessed on the local machine:

```bash
$ ssh -o logLevel=ERROR -L 8501:$IP_ADDRESS:8501 $USERNAME@$IP_ADDRESS
```

```eval_rst
.. note::
   You can avoid port-forwarding by configuring your instance to expose a port
   to the outside world. This is done by adding the following Inbound rule to
   the instance's Security Group:

   * Protocol: TCP
   * Port range: 8501
   * Source: for security, put your IP address here. Or, if public: 0.0.0.0/0
```

## Install Streamlit on the instance

Now that you're SSHed into the instance, make sure to
install Streamlit on it. Using PIP, you can juse do:

```bash
$ pip install streamlit
```

To check that everything is working, run the Hello command:

```bash
$ streamlit hello
```

Ignore the URLs that print on your terminal. Instead, since you're using
port-forwarding you should open your browser at <http://localhost:8501>.

If you see the Streamlit Hello page, everything is working! Otherwise, check
out the [Troubleshooting page](../troubleshooting/index.md).

## Run your own code remotely

Now that you know streamlig is working, let's try your actual code. First,
press `Ctrl+C` to close the Hello program, and then type:

```bash
$ streamlit run my_script.py
```

And that's it! Now your browser should show your script at
<http://localhost:8501>.

## How to edit your remote script

When actively working on a Streamlit app remotely, there are three ways to
edit your remote code:

1. If you use [VS Code](https://code.visualstudio.com/docs/remote/ssh) or the
   paid version of
   [PyCharm](https://www.jetbrains.com/help/pycharm/creating-a-remote-server-configuration.html),
   just point your IDE to your remote file using its SSH feature.
2. If you use some other editor, set up SSHFS as described below.
3. If you're a Vim or Emacs user, just start your editor directly inside the
   instance!

### Optional: Install SSHFS

To get started, install SSHFS using one of the following methods:

- On a Mac:

  ```bash
  $ brew cask install osxfuse
  $ brew install sshfs
  ```

- On Ubuntu:
  ```bash
  $ sudo apt-get update
  $ sudo apt-get install sshfs
  ```

And then set it up:

1. Pick a folder on your remote machine that you would like to sync with your
   local machine. For this tutorial we'll assume it's called `~/sshfs-folder`.

2. Create a folder on your local machine where the remote folder will be mapped
   to. We'll call it `~/remote`, but you can name it whatever you like:

   ```bash
   $ mkdir ~/remote
   ```

3. Open a terminal on your local machine and link the two folders using SSHFS:

   ```bash
   $ sshfs [address of remote machine]:sshfs-folder ~/remote
   ```

That's it!

This should automatically open the file in your favorite local editor. Every
time you save, it will save to the remote file directly.
