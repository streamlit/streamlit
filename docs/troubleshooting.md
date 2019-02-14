```eval_rst
:tocdepth: 1
```

# Troubleshooting

Sometimes you hit a roadblock. That's natural, in coding.

Below are a few problems our users have seen, and ways they solved them in the
past. If what you're looking for is not on this page, let us know at
hello@streamlit.io.

## Remote operation: report URL doesn't load

You ran `streamlit help` or `python my_script.py` and it printed out the URL
where you should find your report --- but it doesn't seem to work when you open
that link in a browser!

When running Streamlit remotely, the number one culprit for this is the
Streamlit port not being opened on your machine/instance.

The fix depends on your setup. Below are two example fixes:
* **"Normal" remote server**: Check the firewall settings.
* **AWS**: First, click on your instance in the [AWS
Console](https://us-west-2.console.aws.amazon.com/ec2/v2/home?region=us-west-2#Instances:sort=instanceId).
Then scroll down and click on _Security Groups_ → _Inbound_ → _Edit_. Next, add
a _Custom TCP_ rule that allows the _Port Range_ `8501` with _Source_
`0.0.0.0/0`.

## Streamlit just hangs when I run my script

In some rare occasions, the Streamlit Proxy from a previous run could be
frozen. A quick way to fix that is shutting down that Proxy before running
your script:

```bash
$ streamlit kill_proxy
```
