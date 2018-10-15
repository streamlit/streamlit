---
title: "Help!"
weight: 103
---

Sometimes people hit roadblocks when using Streamlit. Here are a few problems we have seen, and ways we have solved them in the past. Hopefully, you find a fix that works for you. If not, please let us know (<hello@streamlit.io>).

### Opening the Streamlit report in my browser doesn't work
You ran `streamlit help` or `python my_script.py` and it printed out the URL where you should find your report -
but it doesn't seem to work when you open that link!

**if you are running Streamlit remotely**, this can happen if you haven't opened up port 8501 on your instance.

How do you fix this? First, click on your instance in the [AWS Console](https://us-west-2.console.aws.amazon.com/ec2/v2/home?region=us-west-2#Instances:sort=instanceId). Then scroll down until you see the "Security Groups" & click on that. Click on "Inbound" & "Edit". Next, add a "Custom TCP" rule that allows the Port Range "8501" with Source "0.0.0.0/0".

### Streamlit just hangs when I run my script
Sometimes there is a hanging proxy from your previous run. A quick way to fix that is by running this command:
```bash
$ streamlit kill_proxy
```