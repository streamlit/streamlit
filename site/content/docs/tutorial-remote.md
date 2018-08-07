---
title: "Running Streamlit Remotely"
draft: true
---

Sometimes, you need to run Streamlit remotely -  be it on AWS, GCS, or Paperspace - we've got you! 
Let's do this.

## Before we start
We assume that you already have a machine/instance up & running on AWS, GCS, or Paperspace. The instance should [have a public IP attached to it](https://paperspace.zendesk.com/hc/en-us/articles/236362888-Public-IPs#%E2%80%9Cassign%E2%80%9D),
which we'll now refer to as `PUBLIC_IP`. We assume that your code is on the instance already, in a file called `uber_pickups.py`

For simplicity, we're going to show you how to do all this with Paperspace. The steps are similar for AWS & GCS.

## Running Streamlit Remotely

I will now show you how to install Streamlit on your instance & run your code remotely. First, SSH into your instance: 
```
ssh paperspace@PUBLIC_IP
```
From here, [install Streamlit onto your instance](/docs/installation/).

Next, change the config to tell Streamlit to run remotely. Add these lines to `~/.streamlit/config.yaml`: 

```
proxy:
    isRemote: true
    waitForConnectionSecs: 60
```

Now, let's allow all incoming SSH connections to port 5013 (so you can access the Streamlit report). 
```
sudo ufw allow 5013
```

Finally, run your Streamlit code on your instance!
```
python uber_pickups.py
```

You should now see your report at `http://PUBLIC_IP:5013/?name=uber_pickups`

## From the comfort of your local text editor
When you're actively working on a Streamlit report remotely, you may want to edit the code directly through 
your favorite text editor. We will show you how to do this with Atom and Sublime. Let us know (<hello@streamlit.io>) if you want instructions for other editors.

First, you need to install [rmate](https://github.com/textmate/rmate) on your remote instance:
```
sudo curl -o /usr/local/bin/rmate https://raw.githubusercontent.com/aurora/rmate/master/rmate
sudo chmod +x /usr/local/bin/rmate
```

### Remote Editing with Atom 
If you use Atom, you need to install [Remote Atom](https://atom.io/packages/remote-atom): \
`Atom -> Preferences -> Install -> "remote-atom" -> Install`


Next, we run the Remote Atom Server as follows: \
`Packages -> Remote Atom -> Start Server`


Finally, SSH into your remote machine with remote port fowarded & run rmate:
```
ssh -R 52698:localhost:52698 paperspace@PUBLIC_IP
rmate uber_pickups.py
```

This should automatically open the file in Atom for editing. Every time you save, it will save to the remote file directly.

### Remote Editing with Sublime
If you use Sublime, you need to install [RemoteSubl](https://github.com/randy3k/RemoteSubl): \
`Tools -> Command Palette -> "Package Control: Install Package" -> "RemoteSubl"`

Now you can just SSH into your remote machine with remote port fowarded & run rmate:
```
ssh -R 52698:localhost:52698 paperspace@PUBLIC_IP
rmate uber_pickups.py
```
This should automatically open the file in Sublime for editing. Every time you save, it will save to the remote file directly.


