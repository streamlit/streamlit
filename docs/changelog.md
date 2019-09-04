```eval_rst
:tocdepth: 1
```
# Changelog

See highlights, bug fixes, and known issues for Streamlit releases:

```eval_rst
.. contents::
    :local:
    :depth: 1
```

```eval_rst
.. tip::

   To upgrade to the latest version of Streamlit, run:

   .. code-block:: bash

      # PIP
      $ pip install --upgrade streamlit

   .. code-block:: bash

      # Conda
      $ conda update streamlit
```

## Version 0.45.0
*Release date: August 28, 2019*

**Highlights:**

* 😱 Experimental support for *sidebar*! Let us know if you want to be a beta
  tester.
* 🎁 Completely redesigned `st.cache`! Much more performant, has a cleaner API,
  support for caching functions called by `@st.cached` functions,
  user-friendly error messages, and much more!
* 🖼️ Lightning fast `st.image`, ability to choose between JPEG and PNG
  compression, and between RGB and BGR (for OpenCV).
* 💡 Smarter API for `st.slider`, `st.selectbox`, and `st.radio`.
* 🤖 Automatically fixes the Matplotlib backend -- no need to edit .matplotlibrc

## Version 0.44.0
*Release date: July 28, 2019*

**Highlights:**

• ⚡ Lightning-fast reconnect when you do a ctrl-c/rerun on your Streamlit code
• 📣 Useful error messages when the connection fails
• 💎 Fixed multiple bugs and improved polish of our newly-released interactive widgets

## Version 0.43.0
*Release date: July 9, 2019*

**Highlights:**

* ⚡ Support for interactive widgets! 🎈🎉

## Version 0.42.0
*Release date: July 1, 2019*

**Highlights:**

* 💾 Ability to save Vega-Lite and Altair charts to SVG or PNG
* 🐇 We now cache JS files in your browser for faster loading
* ⛔ Improvements to error-handling inside Streamlit reports

## Version 0.41.0
*Release date: June 24, 2019*

**Highlights:**

* 📈 Greatly improved our support for named datasets in Vega-Lite and Altair
* 🙄 Added ability to ignore certain folders when watching for file changes. See the `server.folderWatchBlacklist` config option.
* ☔ More robust against syntax errors on the user's script and imported modules

## Version 0.40.0
*Release date: June 10, 2019*

**Highlights:**

* Streamlit is more than 10x faster. Just save and watch your analyses update instantly.
* We changed how you run Streamlit reports:
  `$ streamlit run your_script.py [script args]`
* Unlike the previous versions of Streamlit, `streamlit run [script] [script args]` creates a server (now you don't need to worry if the proxy is up). To kill the server, all you need to do is hit **Ctrl+c**.

**Why is this so much faster?**

Now, Streamlit keeps a single Python session running until you kill the server. This means that Streamlit can re-run your code without kicking off a new process; imported libraries are cached to memory. An added bonus is that `st.cache` now caches to memory instead of to disk.

**What happens if I run Streamlit the old way?**

If you run `$ python your_script.py` the script will execute from top to bottom, but won't produce a Streamlit report.

**What are the limitations of the new architecture?**

* To switch Streamlit reports, first you have to kill the Streamlit server with **Ctrl-c**. Then, you can use `streamlit run` to generate the next report.
* Streamlit only works when used inside Python files, not interactively from the Python REPL.

**What else do I need to know?**

* The strings we print to the command line when **liveSave** is on have been cleaned up. You may need to adjust any RegEx that depends on those.
* A number of config options have been renamed:

  ```eval_rst
  .. csv-table::
     :header: "Old config", "New config"
     :align: left

     "proxy.isRemote", "server.headless"
     "proxy.liveSave", "server.liveSave"
     "proxy.runOnSave, proxy.watchFileSystem", "server.runOnSave"
     "proxy.enableCORS", "server.enableCORS"
     "proxy.port", "server.port"
     "browser.proxyAddress", "browser.serverAddress"
     "browser.proxyPort", "browser.serverPort"
     "client.waitForProxySecs", "n/a"
     "client.throttleSecs", "n/a"
     "client.tryToOutliveProxy", "n/a"
     "client.proxyAddress", "n/a"
     "client.proxyPort", "n/a"
     "proxy.autoCloseDelaySecs", "n/a"
     "proxy.reportExpirationSecs","n/a"
  ```

**What if something breaks?**

If the new Streamlit isn’t working, please let us know by Slack or email. You can downgrade at any time with these commands:

```bash
$ pip install --upgrade streamlit==0.37
```

```bash
$ conda install streamlit=0.37
```

**What’s next?**

Thank you for staying with us on this journey! This version of Streamlit lays the foundation for interactive widgets, a new feature of Streamlit we’re really excited to share with you in the next few months.

## Version 0.36.0

*Release date: May 03, 2019*

**Highlights**

* 🚣‍♀️ `st.progress()` now also accepts floats from 0.0–1.0
* 🤯 Improved rendering of long headers in DataFrames
* 🔐 Shared reports now default to HTTPS

## Version 0.35.0

*Release date: April 26, 2019*

**Highlights**

* 📷 Bokeh support! Check out docs for `st.bokeh_chart`
* ⚡️ Improved the size and load time of saved reports
* ⚾️ Implemented better error-catching throughout the codebase
