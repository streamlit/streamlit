# Sanity checks

If you're having problems running your Streamlit app, here are a few "obvious"
things to try out.

## Check #1: Is Streamlit running?

On a Mac or Linux machine, just type this on the terminal:

```bash
$ ps -Al | grep streamlit
```

If you don't see `streamlit run` in the output (or `streamlit hello`, if that's
the command you ran) then the Streamlit server is actually not running for some
reason. So just run it and see if the bug goes away.

## Check #2: Is this an already-fixed Streamlit bug?

We try to fix bugs quickly, so many times a problem will go away when you
upgrade Streamlit. So the first thing to try when having an issue is upgrading
to the latest version of Streamlit:

```bash
$ pip install --upgrade streamlit
$ streamlit version
```

...and then verify that the version number printed is `0.61.0`.

**Try reproducing the issue now.** If not fixed, keep reading on.

## Check #3: Are you running the correct Streamlit binary?

Let's check whether your Python environment is set up correctly. Edit the
Streamlit script where you're experiencing your issue, **comment everything
out, and add these lines instead:**

```python
import streamlit as st
st.write(st.__version__)
```

...then call `streamlit run` on your script and make sure it says the same
version as above. If not the same version, check out [these
instructions](clean-install.md) for some sure-fire ways to set up your
environment.

## Check #4: Is your browser caching your app too aggressively?

There are two easy ways to check this:

1. Load your app in a browser then press `Ctrl-Shift-R` or `⌘-Shift-R` to do a
   hard refresh (Chrome/Firefox).

2. As a test, run Streamlit on another port. This way the browser starts the
   page with a brand new cache. For that, just pass the `--server.port`
   argument to Streamlit on the command line:

   ```bash
   $ streamlit run my_app.py --server.port=9876
   ```

## Check #5: Is this a Streamlit regression?

If you've upgraded to the latest version of Streamlit and things aren't
working, you can downgrade at any time using this command:

```bash
$ pip install --upgrade streamlit==0.50
```

...where `0.50` is the version you'd like to downgrade to. See
[Changelog](../changelog.md) for a complete list of Streamlit versions.
