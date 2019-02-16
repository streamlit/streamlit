# Tutorial 3: Running Streamlit remotely

Sometimes, you need to run Streamlit remotely --- be it on AWS, GCS, a Docker
instance, or some other remote machine --- we've got you covered! In this
tutorial, we're going to show you how to set up remote operation with AWS. The
steps are similar for other services.

## Before we start

We assume that:

1. You have a machine/instance up and running on AWS.
2. Your instance allows incoming TCP connections at port 8501.
3. Your code is already on the remote machine, in a file called `my_script.py`.

## Setup

To start with, SSH into your machine. On AWS you can find the command to do
this by right-clicking on your
[instance](https://us-west-2.console.aws.amazon.com/ec2/v2/home?region=us-west-2#Instances:sort=instanceId)
and clicking on "Connect".

From here, [install Streamlit onto the remote machine](/getting_started).

To make sure everything is working, run the Streamlit Hello World:

```bash
$ streamlit hello
```

A couple of URLs should appear in your terminal.

Now click on the one labeled _remote URL_ (or ctrl-click on Linux) and watch a
Streamlit report pop up on your browser.


## Running your own code remotely

Based on the last command in the previous section, you probably already guessed
how to run your Streamlit-powered code on a remote host: just do it the same
way you're used to on your local machine!

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
edit the code directly through your favorite text editor.
We find that the most sure-fire way to do this is to use SSHFS.

To get started, install SSHFS using one of the following methods:

* On a Mac:
  ```bash
  $ brew cask install osxfuse
  $ brew install sshfs
  ```

* On Ubuntu:
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

This should automatically open the file in Atom or Sublime for editing. Every
time you save, it will save to the remote file directly.


## From the comfort of Vi/Emacs

There are two ways to edit remote files in Vi/Emacs:

1. In your local machine, open the file like you'd open any local file, but
   specify its full address in the form `username@EXTERNAL_IP:filepath`.

2. Or you can just SSH into your remote machine and edit the file from there.
   It's good to be a Vi/Emacs user ☺
