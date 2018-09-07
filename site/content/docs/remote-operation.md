---
title: "Running Streamlit remotely"
weight: 102
---

Sometimes, you need to run Streamlit remotely --- be it on AWS, or GCS --- we've got you! In this tutorial,
we're going to show you how to set up remote operation with AWS. The steps are similar for other services.


## Before we start
We assume that:

* you already have a machine/instance up and running on AWS, GCS, or whatever other computer you have access to,
* your instance allows incoming TCP connections at port 8501, and
* your code is already on the instance, in a file called `my_script.py`.

## Configuration

To start with, SSH into your instance. You can find the command to do this by right-clicking on your [instance](https://us-west-2.console.aws.amazon.com/ec2/v2/home?region=us-west-2#Instances:sort=instanceId) and clicking on "Connect".

From here, [install Streamlit onto your instance](/docs/installation/).

Next, we need to configure Streamlit to tell it to run remotely. To do this, first find out your instance's external IP:
```
$ curl http://checkip.amazonaws.com
```
Let's call it `EXTERNAL_IP`. Next, add these lines to `~/.streamlit/config.yaml`:

```bash
proxy:
    isRemote: true
    waitForConnectionSecs: 60
    externalIP: EXTERNAL_IP
```

_NOTE: You may have to create this file if it doesn't exist yet._

Finally, to make sure everything worked, run the Streamlit cheat sheet and try
to access it in your local browser:

```bash
$ streamlit help
```

This command will print out the URL at which your report is available. Click on it!


## Running remote code

Based on the last command in the previous section, you probably already guessed
that you run Streamlit-powered code on your remote host the same way you run it
on your local machine!

So that's just:

```bash
$ python my_script.py
```

The main difference is that your local web browser will not automatically open
when the remote script runs. Instead, you need to open your browser yourself
and point it to the URL printed by running your script.

And that's it!


## From the comfort of your local text editor

When actively working on a Streamlit report remotely, you may want to
edit the code directly through your favorite text editor. We will now show you
how to do this with Atom, Sublime Text, Vi, and Emacs. Let us know
(<hello@streamlit.io>) if you'd like instructions for other editors, or if
you have instructions to contribute!

### Atom and Sublime Text
If you use Atom, you need to install [Remote Atom](https://atom.io/packages/remote-atom) and then run the Remote Atom Server:

* _Atom → Preferences → Install → "remote-atom" → Install_

* _Packages → Remote Atom → Start Server_

If you use Sublime Text, you need to install
[RemoteSubl](https://github.com/randy3k/RemoteSubl):

* _Tools → Command Palette → "Package Control: Install Package" → "RemoteSubl"_

Now that you have the right plug-in install, install rmate onto your instance. You do this as follows:
```bash
$ sudo curl -o /usr/local/bin/rmate https://raw.githubusercontent.com/aurora/rmate/master/rmate
$ sudo chmod +x /usr/local/bin/rmate
```

Next, SSH into your remote machine with remote port fowarded. You do this by appending the following to the end of your SSH command:

```
-R 52698:localhost:52698
```

Finally, run rmate from your instance:
```bash
$ rmate my_script.py
```

This should automatically open the file in Atom or Sublime for editing. Every time you save, it will save to the remote file directly.


### Vi or Emacs

There are two ways to edit remote files in Vi/Emacs:

1. In your local machine, open the file like you'd open any local file, but
   specify its full address in the form `username@EXTERNAL_IP:filepath`.

2. Or you can just SSH into your remote machine and edit the file from there ☺

Simple!

## Debugging
Here are a few problems we have seen and how to solve them.

### Opening the Streamlit report in my browser doesn't work
You ran `streamlit help` or `python my_script.py` and it printed out the URL where you should find your report - but it doesn't seem to work when you open that link! One case where this happens is if you haven't opened up port 8501 on your instance.

How do you fix this? First, click on your instance in the [AWS Console](https://us-west-2.console.aws.amazon.com/ec2/v2/home?region=us-west-2#Instances:sort=instanceId). Then scroll down until you see the "Security Groups" & click on that. Click on "Inbound" & "Edit". Next, add a "Custom TCP" rule that allows the Port Range "8501" with Source "0.0.0.0/0". 

### It just hangs when I run my script
Sometimes there is a hanging proxy from your previous run. A quick way to fix that is by running this command:
```
streamlit kill_proxy
```

If that doesn't fix it, please contact us!



