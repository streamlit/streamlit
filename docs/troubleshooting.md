```eval_rst
:tocdepth: 1
```

# Troubleshooting

Sometimes you hit a roadblock. That's natural, in coding.

Below are a few problems our users have seen, and ways they solved them in the
past. If what you're looking for is not on this page, let us know at
[help@streamlit.io](mailto:help@streamlit.io).

## First things to try...

We try to fix bugs quickly, so many times a problem will go away when you
upgrade Streamlit. So the first thing to try when having an issue is upgrading
to the latest version of Streamlit:

```bash
$ pip install --upgrade streamlit
$ streamlit version
```

...and then verify that the version number printed is `0.47.2`.

**Try reproducing the issue now.**

If not fixed, let's check whether your Python environment is set up correctly.
Edit the Streamlit script where you're experiencing your issue,
**comment everything out, and add these lines instead:**

```python
import streamlit as st
st.write(st.__version__)
```

...and make sure it says the same version as above. If not the same version,
[contact us](mailto:help@streamlit.io) for help setting up your
environment.

One more thing to try: sometimes the browser caches Streamlit's JavaScript code
too aggressively. There are two ways to address it:

1. Try pressing `Ctrl-Shift-R` or `⌘-Shift-R` to do a hard refresh in
   Chrome/Firefox.

2. Try using Streamlit on another port. This way the browser starts the page
   with a brand new cache. For that, add this to `~/.streamlit/config.toml`:

```ini
[server]
port=8765
```

See if you can reproduce your bug again now. If the answer is _yes_,
continue reading this page or [contact us](mailto:help@streamlit.io).

## Remote operation: app URL doesn't load

You ran `streamlit hello` or `streamlit run my_script.py` and it printed out
the URL where you should find your app --- but it doesn't seem to work when
you open that link in a browser!

When running Streamlit remotely, the number one culprit for this is the
Streamlit port not being opened on your machine/instance.

The fix depends on your setup. Below are two example fixes:

- **"Normal" remote server**: Check the firewall settings.
- **AWS**: First, click on your instance in the [AWS
  Console](https://us-west-2.console.aws.amazon.com/ec2/v2/home?region=us-west-2#Instances:sort=instanceId).
  Then scroll down and click on _Security Groups_ → _Inbound_ → _Edit_. Next, add
  a _Custom TCP_ rule that allows the _Port Range_ `8501` with _Source_
  `0.0.0.0/0`.

## Using Streamlit with Pex

Streamlit has experimental support for [Pex](https://github.com/pantsbuild/pex)
binaries, but with one limitation: the package must not have an entry point.

For instance:

```bash
$ pex streamlit foo bar -o mypexbinary.pex
```

...which means you can do things like:

- Running an interactive console:

  ```bash
  $ ./mypexbinary.pex
  >>> import streamlit as st
  >>> st.write('Hello from the console!')
  ```

- Running a script:

  ```bash
  $ ./mypexbinary.pex myscript.py
  ```

- Running the Streamlit CLI tool:
  ```bash
  $ ./mypexbinary.pex -m streamlit hello
  ```

## Downgrade Streamlit

If you've upgraded to the latest version of Streamlit and things aren't working, you can downgrade at any time using these commands:

You can downgrade at any time with these commands:

```bash
$ pip install --upgrade streamlit==0.37 # <- To downgrade Streamlit!
```
