---
title: "Running Streamlit remotely"
weight: 102
---

Sometimes, you need to run Streamlit remotely --- be it on AWS, GCS, or
Paperspace --- we've got you!

Let's do this.

## Before we start

For this tutorial, we assume that you already have a machine/instance up and
running on AWS, GCS, Paperspace, or whatever other computer you have access to.
For simplicity, we're going to show you how to do all this with Paperspace. The
steps are similar for other hosts.

Let's say the address of this computer/machine/instance is `REMOTE_HOST`. For
Paperspace, that's [the public IP attached
to](https://paperspace.zendesk.com/hc/en-us/articles/236362888-Public-IPs#%E2%80%9Cassign%E2%80%9D)
your instance.

And let's assume that your code is on the instance already, in a file called
`my_script.py`.

## Configuration

To start with, SSH into your instance:

```bash
$ ssh paperspace@REMOTE_HOST
```

From here, [install Streamlit onto your instance](/docs/installation/).

Next, we need to configure Streamlit to let it know it's running remotely.
So go ahead and add these lines to `~/.streamlit/config.yaml`:

```bash
proxy:
    isRemote: true
    waitForConnectionSecs: 60
```

_NOTE: You may have to create this file if it doesn't exist yet._

Now, let's set up the instance's firewall to allow all incoming SSH connections
to port 8501, so you can access the Streamlit report:

```
$ sudo ufw allow 8501
```

Finally, to make sure everything worked, run the Streamlit cheat sheet and try
to access it in your local browser:

```bash
$ streamlit help
```

The report should be available at `http://REMOTE_HOST:8501/?name=help`


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
and point it to: `http://REMOTE_HOST:8501/?name=my_script`

And that's it!


## From the comfort of your local text editor

When actively working on a Streamlit report remotely, you may want to
edit the code directly through your favorite text editor. We will now show you
how to do this with Atom, Sublime Text, Vi, and Emacs. Let us know
(<hello@streamlit.io>) if you'd like instructions for other editors, or if
you have instructions to contribute!

For Atom or Sublime Text, you should first install
[rmate](https://github.com/textmate/rmate) on your remote instance:

```bash
$ ssh paperspace@REMOTE_HOST
$ sudo curl -o /usr/local/bin/rmate https://raw.githubusercontent.com/aurora/rmate/master/rmate
$ sudo chmod +x /usr/local/bin/rmate
```

### Atom

If you use Atom, you need to install [Remote
Atom](https://atom.io/packages/remote-atom):

* _Atom → Preferences → Install → "remote-atom" → Install_

Then run the Remote Atom Server:

* _Packages → Remote Atom → Start Server_

Finally, SSH into your remote machine with remote port fowarded & run rmate:

```bash
$ ssh -R 52698:localhost:52698 paperspace@REMOTE_HOST
$ rmate my_script.py
```

This should automatically open the file in Atom for editing. Every time you
save, it will save to the remote file directly.


### Sublime Text

If you use Sublime Text, you need to install
[RemoteSubl](https://github.com/randy3k/RemoteSubl):

* _Tools → Command Palette → "Package Control: Install Package" → "RemoteSubl"_

Now you can just SSH into your remote machine with remote port fowarded and run
rmate:

```bash
$ ssh -R 52698:localhost:52698 paperspace@REMOTE_HOST
$ rmate my_script.py
```

This should automatically open the file in Sublime Text for editing. Every time
you save, it will save to the remote file directly.


### Vi or Emacs

There are two ways to edit remote files in Vi/Emacs:

1. In your local machine, open the file like you'd open any local file, but
   specify its full address in the form `username@REMOTE_HOST:filepath`.

2. Or you can just SSH into your remote machine and edit the file from there ☺

Simple!
