---
title: "Running Streamlit remotely"
weight: 102
---

Sometimes, you need to run Streamlit remotely --- be it on AWS, or GCS --- we've
got you! In this tutorial, we're going to show you how to set up remote
operation with AWS. The steps are similar for other services.


_**NOTE:** If you hit any issues going through this tutorial, check out our
[Help](/docs/help/) page._

## Before we start

We assume that:

* you have a machine/instance up and running on AWS
* your instance allows incoming TCP connections at port 8501,
* and your code is already on the instance, in a file called `my_script.py`

## Setup

To start with, SSH into your instance. You can find the command to do this by
right-clicking on your
[instance](https://us-west-2.console.aws.amazon.com/ec2/v2/home?region=us-west-2#Instances:sort=instanceId)
and clicking on "Connect".

From here, [install Streamlit onto your instance](/docs/installation/).

To make sure everything is working, run the Streamlit cheat sheet:

```bash
$ streamlit help
```

A couple of URLs should appear in your terminal.

Now click on the one labeled _remote URL_ (or ctrl-click on Linux) and watch a
Streamlit report pop up on your browser.


## Running your own code remotely

Based on the last command in the previous section, you probably already guessed
how to run your Streamlit-powered code on a remote host: just do it the same way
you're used to on your local machine!

So that's just:

```bash
$ python my_script.py
```

The main difference is that your local web browser will not automatically open
when the remote script runs. Instead, open the remote URL printed in the
terminal.

And that's it!


## From the comfort of your local text editor

When actively working on a Streamlit report remotely, you may want to
edit the code directly through your favorite text editor. We will now show you
how to do this with Atom, Sublime Text, Vi, and Emacs. Let us know
(<hello@streamlit.io>) if you'd like instructions for other editors, or if
you have instructions to contribute!

### Atom and Sublime Text

If you use Atom, you need to install [Remote
Atom](https://atom.io/packages/remote-atom) and then run the Remote Atom Server:

* _Atom → Preferences → Install → "remote-atom" → Install_

* _Packages → Remote Atom → Start Server_

If you use Sublime Text, you need to install
[RemoteSubl](https://github.com/randy3k/RemoteSubl):

* _Tools → Command Palette → "Package Control: Install Package" → "RemoteSubl"_

Now that you have the right plug-in install, install rmate onto your instance.
You do this as follows:

```bash
$ sudo curl -o /usr/local/bin/rmate https://raw.githubusercontent.com/aurora/rmate/master/rmate
$ sudo chmod +x /usr/local/bin/rmate
```

Next, SSH into your remote machine with remote port fowarded. You do this by
appending the following to the end of your SSH command: ```-R
52698:localhost:52698```

Finally, run rmate from your instance:
```bash
$ rmate my_script.py
```

This should automatically open the file in Atom or Sublime for editing. Every
time you save, it will save to the remote file directly.


### Vi and Emacs

There are two ways to edit remote files in Vi/Emacs:

1. In your local machine, open the file like you'd open any local file, but
   specify its full address in the form `username@EXTERNAL_IP:filepath`.

2. Or you can just SSH into your remote machine and edit the file from there ☺

Simple!




