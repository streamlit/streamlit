```eval_rst
:tocdepth: 1
```

# Changelog

This page lists highlights, bug fixes, and known issues for official Streamlit releases. If you're looking for information about nightly releases, beta features, or experimental features, see [Try pre-release features](api.html#pre-release-features).

```eval_rst
.. tip::

   To upgrade to the latest version of Streamlit, run:

   .. code-block:: bash

      $ pip install --upgrade streamlit
```

## Version 0.78.0

_Release date: Mar 4, 2021_

**Features**

- If you're in the Streamlit for Teams beta, we made a few updates to how secrets work. Check the beta docs for more info!
- Dataframes now displays timezones for all DateTime and Time columns, and shows the time with the timezone applied, rather than in UTC

**Notable Bug Fixes**

- Various improvement to column alignment in `st.beta_columns`
- Removed the long-deprecated `format` param from `st.image`, and replaced with `output_format`.

## Version 0.77.0

_Release date: Feb 23, 2021_

**Features**

- Added a new config option `client.showErrorDetails` allowing the developer to control the granularity of error messages. This is useful for when you deploy an app, and want to conceal from your users potentially-sensitive information contained in tracebacks.

**Notable bug fixes**

- Fixed [bug](https://github.com/streamlit/streamlit/issues/1957) where `st.image` wasn't rendering certain kinds of SVGs correctly.
- Fixed [regression](https://github.com/streamlit/streamlit/issues/2699) where the current value of an `st.slider` was only shown on hover.

## Version 0.76.0

_Release date: February 4, 2021_

**Notable Changes**

- 🎨 [`st.color_picker`](https://docs.streamlit.io/en/0.76.0/api.html#streamlit.color_picker) is now out of beta. This means the old beta_color_picker function, which was marked as deprecated for the past 3 months, has now been replaced with color_picker.
- 🐍 Display a warning when a Streamlit script is run directly as `python script.py`.
- [`st.image`](https://docs.streamlit.io/en/0.76.0/api.html#streamlit.image)'s `use_column_width` now defaults to an `auto` option which will resize the image to the column width if the image exceeds the column width.
- ✂️ Fixed bugs ([2437](https://github.com/streamlit/streamlit/issues/2437) and [2247](https://github.com/streamlit/streamlit/issues/2247)) with content getting cut off within a [`st.beta_expander`](https://docs.streamlit.io/en/0.76.0/api.html#streamlit.beta_expander)
- 📜 Fixed a [bug](https://github.com/streamlit/streamlit/issues/2543) in [`st.dataframe`](https://docs.streamlit.io/en/0.76.0/api.html#streamlit.dataframe) where the scrollbar overlapped with the contents in the last column.
- 💾 Fixed a [bug](https://github.com/streamlit/streamlit/issues/2561) for [`st.file_uploader`](https://docs.streamlit.io/en/0.76.0/api.html#streamlit.file_uploader) where file data returned was not the most recently uploaded file.
- ➕ Fixed bugs ([2086](https://github.com/streamlit/streamlit/issues/2086) and [2556](https://github.com/streamlit/streamlit/issues/2556)) where some LaTeX commands were not rendering correctly.

## Version 0.75.0

_Release date: January 21, 2021_

**Notable Changes**

- 🕳 [`st.empty`](https://docs.streamlit.io/en/0.75.0/api.html#streamlit.empty)
  previously would clear the component at the end of the script. It has now been
  updated to clear the component instantly.
- 🛹 Previously in wide mode, we had thin margins around the webpage. This has
  now been increased to provide a better visual experience.

## Version 0.74.0

_Release date: January 6, 2021_

**Notable Changes**

- 💾 [`st.file_uploader`](https://docs.streamlit.io/en/0.74.0/api.html#streamlit.file_uploader). has been stabilized and the deprecation warning
  and associated configuration option (`deprecation.showfileUploaderEncoding`) has been removed.
- 📊 [`st.bokeh_chart`](https://docs.streamlit.io/en/0.74.0/api.html#streamlit.bokeh_chart) is no longer duplicated when the page loads.
- 🎈 Fixed page icon to support emojis with variants (i.e. 🤦‍♀️ vs 🤦🏼‍♀️) or dashes (i.e 🌙 - crescent-moon).

## Version 0.73.0

_Release date: December 17, 2020_

**Notable Changes**

- 🐍 Streamlit can now be installed on Python 3.9. Streamlit components are not
  yet compatible with Python 3.9 and must use version 3.8 or earlier.
- 🧱 Streamlit Components now allows same origin, enabling features provided by
  the browser such as a webcam component.
- 🐙 Fix Streamlit sharing deploy experience for users running on Git versions
  2.7.0 or earlier.
- 🧰 Handle unexpected closing of uploaded files for [`st.file_uploader`](https://docs.streamlit.io/en/0.72.0/api.html#streamlit.file_uploader).

## Version 0.72.0

_Release date: December 2, 2020_

**Notable Changes**

- 🌈 Establish a framework for theming and migrate existing components.
- 📱 Improve the sidebar experience for mobile devices.
- 🧰 Update [`st.file_uploader`](https://docs.streamlit.io/en/0.71.0/api.html#streamlit.file_uploader) to reduce reruns.

## Version 0.71.0

_Release date: November 11, 2020_

**Notable Changes**

- 📁 Updated [`st.file_uploader`](https://docs.streamlit.io/en/0.71.0/api.html#streamlit.file_uploader)
  to automatically reset buffer on app reruns.
- 📊 Optimize the default rendering of charts and reduce issues with the initial render.

## Version 0.70.0

_Release date: October 28, 2020_

**Notable Changes**

- 🧪 [`st.set_page_config`](https://docs.streamlit.io/en/0.70.0/api.html#streamlit.set_page_config) and [`st.color_picker`](https://docs.streamlit.io/en/0.70.0/api.html#streamlit.color_picker) have now been moved into the
  Streamlit namespace. These will be removed from beta January 28th, 2021. Learn
  more about our beta process [here](https://docs.streamlit.io/en/0.70.0/api.html#beta-and-experimental-features).
- 📊 Improve display of bar charts for discrete values.

## Version 0.69.0

_Release date: October 15, 2020_

**Highlights:**

- 🎁 Introducing Streamlit sharing, the best way to deploy, manage, and share your public Streamlit apps - for free. Read more about it on our [blog post](http://blog.streamlit.io/introducing-streamlit-sharing/) or sign up [here](https://streamlit.io/sharing)!
- Added `st.experimental_rerun` to programatically re-run your app. Thanks [SimonBiggs](https://github.com/SimonBiggs)!

**Notable Changes**

- 📹 Better support across browsers for start and stop times for st.video.
- 🖼 Bug fix for intermittently failing media files
- 📦 Bug fix for custom components compatibility with Safari. Make sure to upgrade to the latest [streamlit-component-lib](https://www.npmjs.com/package/streamlit-component-lib).

## Version 0.68.0

_Release date: October 8, 2020_

**Highlights:**

- ⌗ Introducing new layout options for Streamlit! Move aside, vertical layout.
  Make a little space for... horizontal layout! Check out our
  [blog post](https://blog.streamlit.io/introducing-new-layout-options-for-streamlit/).
- 💾 File uploader redesigned with new functionality for multiple files uploads
  and better support for working with uploaded files. This may cause breaking
  changes. Please see the new api in our
  [documentation](https://docs.streamlit.io/en/0.68.0/api.html#streamlit.file_uploader)

**Notable Changes**

- 🎈 `st.balloon` has gotten a facelift with nicer balloons and smoother animations.
- 🚨 Breaking Change: Following the deprecation of `st.deck_gl_chart` in
  January 2020, we have now removed the API completely. Please use
  `st.pydeck_chart` instead.
- 🚨 Breaking Change: Following the deprecation of `width` and `height` for
  `st.altair_chart`, `st.graphviz_chart`, `st.plotly_chart`, and
  `st.vega_lite_chart` in January 2020, we have now removed the args completely.
  Please set the width and height in the respective charting library.

## Version 0.67.0

_Release date: September 16, 2020_

**Highlights:**

- 🦷 Streamlit Components can now return bytes to your Streamlit App. To create a
  component that returns bytes, make sure to upgrade to the latest
  [streamlit-component-lib](https://www.npmjs.com/package/streamlit-component-lib).

**Notable Changes**

- 📈 Deprecation warning: Beginning December 1st, 2020 `st.pyplot()` will require a figure to
  be provided. To disable the deprecation warning, please set `deprecation.showPyplotGlobalUse`
  to `False`
- 🎚 `st.multiselect` and `st.select` are now lightning fast when working with large datasets. Thanks [masa3141](https://github.com/masa3141)!

## Version 0.66.0

_Release date: September 1, 2020_

**Highlights:**

- ✏️ `st.write` is now available for use in the sidebar!
- 🎚 A slider for distinct or non-numerical values is now available with `st.select_slider`.
- ⌗ Streamlit Components can now return dataframes to your Streamlit App. Check out our [SelectableDataTable example](https://github.com/streamlit/component-template/tree/master/examples/SelectableDataTable).
- 📦 The Streamlit Components library used in our Streamlit Component template is
  now available as a npm package ([streamlit-component-lib](https://www.npmjs.com/package/streamlit-component-lib)) to simplify future upgrades to the latest version.
  Existing components do not need to migrate.

**Notable Changes**

- 🐼 Support StringDtype from pandas version 1.0.0
- 🧦 Support for running Streamlit on Unix sockets

## Version 0.65.0

_Release date: August 12, 2020_

**Highlights:**

- ⚙️ Ability to set page title, favicon, sidebar state, and wide mode via st.beta_set_page_config(). See our [documentation](https://docs.streamlit.io/en/0.65.0/api.html#streamlit.set_page_config) for details.
- 📝 Add stateful behaviors through the use of query parameters with st.experimental_set_query_params and st.experimental_get_query_params. Thanks [@zhaoooyue](https://github.com/zhaoooyue)!
- 🐼 Improved pandas dataframe support for st.radio, st.selectbox, and st.multiselect.
- 🛑 Break out of your Streamlit app with st.stop.
- 🖼 Inline SVG support for st.image.

**Callouts:**

- 🚨Deprecation Warning: The st.image parameter format has been renamed to output_format.

## Version 0.64.0

_Release date: July 23, 2020_

**Highlights:**

- 📊 Default matplotlib to display charts with a tight layout. To disable this,
  set `bbox_inches` to `None`, inches as a string, or a `Bbox`
- 🗃 Deprecation warning for automatic encoding on `st.file_uploader`
- 🙈 If `gatherUserStats` is `False`, do not even load the Segment library.
  Thanks [@tanmaylaud](https://github.com/tanmaylaud)!

## Version 0.63.0

_Release date: July 13, 2020_

**Highlights:**

- 🧩 **Support for Streamlit Components!!!** See
  [documentation](https://docs.streamlit.io/en/latest/streamlit_components.html) for more info.
- 🕗 Support for datetimes in
  [`st.slider`](https://docs.streamlit.io/en/latest/api.html#streamlit.slider). And, of course, just
  like any other value you use in `st.slider`, you can also pass in two-element lists to get a
  datetime range slider.

## Version 0.62.0

_Release date: June 21, 2020_

**Highlights:**

- 📨 Ability to turn websocket compression on/off via the config option
  `server.enableWebsocketCompression`. This is useful if your server strips HTTP headers and you do
  not have access to change that behavior.
- 🗝️ Out-of-the-box support for CSRF protection using the
  [Cookie-to-header token](https://en.wikipedia.org/wiki/Cross-site_request_forgery#Cookie-to-header_token)
  technique. This means that if you're serving your Streamlit app from multiple replicas you'll need
  to configure them to to use the same cookie secret with the `server.cookieSecret` config option.
  To turn XSRF protection off, set `server.enableXsrfProtection=false`.

**Notable bug fixes:**

- 🖼️ Added a grace period to the image cache expiration logic in order to fix multiple related bugs
  where images sent with `st.image` or `st.pyplot` were sometimes missing.

## Version 0.61.0

_Release date: June 2, 2020_

**Highlights:**

- 📅 Support for date ranges in `st.date_picker`. See
  [docs](https://docs.streamlit.io/en/latest/api.html#streamlit.date_picker)
  for more info, but the TLDR is: just pass a list/tuple as the default date and it will be
  interpreted as a range.
- 🗣️ You can now choose whether `st.echo` prints the code above or below the output of the echoed
  block. To learn more, refer to the `code_location` argument in the
  [docs](https://docs.streamlit.io/en/latest/api.html#streamlit.echo).
- 📦 Improved `@st.cache` support for Keras models and Tensorflow `saved_models`.

## Version 0.60.0

_Release date: May 18, 2020_

**Highlights:**

- ↕️ Ability to set the height of an `st.text_area` with the `height` argument
  (expressed in pixels). See
  [docs](https://docs.streamlit.io/en/latest/api.html#streamlit.text_area) for more.
- 🔡 Ability to set the maximimum number of characters allowed in `st.text_area`
  or `st.text_input`. Check out the `max_chars` argument in the
  [docs](https://docs.streamlit.io/en/latest/api.html#streamlit.text_area).
- 🗺️ Better DeckGL support for the [H3](https://h3geo.org/) geospatial indexing
  system. So now you can use things like `H3HexagonLayer` in
  [`st.pydeck_chart`](https://docs.streamlit.io/en/latest/api.html#streamlit.pydeck_chart).
- 📦 Improved `@st.cache` support for PyTorch TensorBase and Model.

## Version 0.59.0

_Release date: May 05, 2020_

**Highlights:**

- 🎨 New color-picker widget! Use it with
  [`st.beta_color_picker()`](https://docs.streamlit.io/en/0.69.0/api.html#streamlit.beta_color_picker)
- 🧪 Introducing `st.beta_*` and `st.experimental_*` function prefixes, for faster
  Streamlit feature releases. See
  [docs](https://docs.streamlit.io/en/latest/api.html#pre-release-features) for more info.
- 📦 Improved `@st.cache` support for SQL Alchemy objects, CompiledFFI, PyTorch
  Tensors, and `builtins.mappingproxy`.

## Version 0.58.0

_Release date: April 22, 2020_

**Highlights:**

- 💼 Made `st.selectbox` filtering case-insensitive.
- ㈬ Better support for Tensorflow sessions in `@st.cache`.
- 📊 Changed behavior of `st.pyplot` to auto-clear the figure only when using
  the global Matplotlib figure (i.e. only when calling `st.pyplot()` rather
  than `st.pyplot(fig)`).

## Version 0.57.0

_Release date: March 26, 2020_

**Highlights:**

- ⏲️ Ability to set expiration options for `@st.cache`'ed functions by setting
  the `max_entries` and `ttl` arguments. See
  [docs](https://docs.streamlit.io/en/latest/api.html#streamlit.cache).
- 🆙 Improved the machinery behind `st.file_uploader`, so it's much more
  performant now! Also increased the default upload limit to 200MB
  (configurable via `server.max_upload_size`).
- 🔒 The `server.address` config option now _binds_ the server to that address
  for added security.
- 📄 Even more details added to error messages for `@st.cache` for easier
  debugging.

## Version 0.56.0

_Release date: February 15, 2020_

**Highlights:**

- 📄 Improved error messages for st.cache. The errors now also point to the new
  caching docs we just released. Read more
  [here](https://discuss.streamlit.io/t/help-us-stress-test-streamlit-s-latest-caching-update/1944)!

**Breaking changes:**

- 🐍 As [announced last month](https://discuss.streamlit.io/t/streamlit-will-deprecate-python-2-in-february/1656),
  **Streamlit no longer supports Python 2.** To use Streamlit you'll need
  Python 3.5 or above.

## Version 0.55.0

_Release date: February 4, 2020_

**Highlights:**

- 📺 **Ability to record screencasts directly from Streamlit!** This allows
  you to easily record and share explanations about your models, analyses,
  data, etc. Just click ☰ then "Record a screencast". Give it a try!

## Version 0.54.0

_Release date: January 29, 2020_

**Highlights:**

- ⌨️ Support for password fields! Just pass `type="password"` to
  `st.text_input()`.

**Notable fixes:**

- ✳️ Numerous st.cache improvements, including better support for complex objects.
- 🗣️ Fixed cross-talk in sidebar between multiple users.

**Breaking changes:**

- If you're using the SessionState <del>hack</del> Gist, you should re-download it!
  Depending on which hack you're using, here are some links to save you some
  time:
  - [SessionState.py](https://gist.github.com/tvst/036da038ab3e999a64497f42de966a92)
  - [st_state_patch.py](https://gist.github.com/tvst/0899a5cdc9f0467f7622750896e6bd7f)

## Version 0.53.0

_Release date: January 14, 2020_

**Highlights:**

- 🗺️ Support for all DeckGL features! Just use
  [Pydeck](https://deckgl.readthedocs.io/en/latest/) instead of
  [`st.deck_gl_chart`](https://docs.streamlit.io/en/latest/api.html#streamlit.pydeck_chart).
  To do that, simply pass a PyDeck object to
  [`st.pydeck_chart`](https://docs.streamlit.io/en/latest/api.html#streamlit.pydeck_chart),
  [`st.write`](https://docs.streamlit.io/en/latest/api.html#streamlit.write),
  or [magic](https://docs.streamlit.io/en/latest/api.html#magic).

  _Note that as a **preview release** things may change in the near future.
  Looking forward to hearing input from the community before we stabilize the
  API!_

  **The goals is for this to replace `st.deck_gl_chart`,** since it
  is does everything the old API did _and much more!_

- 🆕 Better handling of Streamlit upgrades while developing. We now auto-reload
  the browser tab if the app it is displaying uses a newer version of Streamlit
  than the one the tab is running.

- 👑 New favicon, with our new logo!

**Notable fixes:**

- Magic now works correctly in Python 3.8. It no longer causes
  docstrings to render in your app.

**Breaking changes:**

- Updated how we calculate the default width and height of all chart types.
  We now leave chart sizing up to your charting library itself, so please refer
  to the library's documentation.

  As a result, the `width` and `height` arguments have been deprecated
  from most chart commands, and `use_container_width` has been introduced
  everywhere to allow you to make charts fill as much horizontal space as
  possible (this used to be the default).

## Version 0.52.0

_Release date: December 20, 2019_

**Highlights:**

- 📤 Preview release of the file uploader widget. To try it out just call
  [`st.file_uploader`](https://docs.streamlit.io/en/latest/api.html#streamlit.file_uploader)!

  _Note that as a **preview release** things may change in the near future.
  Looking forward to hearing input from the community before we stabilize the
  API!_

- 👋 Support for [emoji codes](https://www.webfx.com/tools/emoji-cheat-sheet/) in
  `st.write` and `st.markdown`! Try it out with `st.write("Hello :wave:")`.

**Breaking changes:**

- 🧹 `st.pyplot` now clears figures by default, since that's what you want 99% of
  the time. This allows you to create two or more Matplotlib charts without
  having to call
  [`pyplot.clf`](https://matplotlib.org/3.1.1/api/_as_gen/matplotlib.pyplot.clf.html)
  every time. If you want to turn this behavior off, use
  [`st.pyplot(clear_figure=False)`](https://docs.streamlit.io/en/latest/api.html#streamlit.pyplot)
- 📣 `st.cache` no longer checks for input mutations. This is the first change
  of our ongoing effort to simplify the caching system and prepare Streamlit
  for the launch of other caching primitives like Session State!

## Version 0.51.0

_Release date: November 30, 2019_

**Highlights:**

- 🐕 You can now tweak the behavior of the file watcher with the config option `server.fileWatcherType`. Use it to switch between:
  - `auto` (default) : Streamlit will attempt to use the watchdog module, and
    falls back to polling if watchdog is not available.
  - `watchdog` : Force Streamlit to use the watchdog module.
  - `poll` : Force Streamlit to always use polling.
  - `none` : Streamlit will not watch files.

**Notable bug fixes:**

- Fix the "keyPrefix" option in static report sharing [#724](https://github.com/streamlit/streamlit/pull/724)
- Add support for getColorX and getTargetColorX to DeckGL Chart [#718](https://github.com/streamlit/streamlit/pull/718)
- Fixing Tornado on Windows + Python 3.8 [#682](https://github.com/streamlit/streamlit/pull/682)
- Fall back on webbrowser if xdg-open is not installed on Linux [#701](https://github.com/streamlit/streamlit/pull/701)
- Fixing number input spin buttons for Firefox [#683](https://github.com/streamlit/streamlit/pull/683)
- Fixing CTRL+ENTER on Windows [#699](https://github.com/streamlit/streamlit/pull/699)
- Do not automatically create credential file when in headless mode [#467](https://github.com/streamlit/streamlit/pull/467)

## Version 0.50.1

_Release date: November 10, 2019_

**Highlights:**

- 👩‍🎓 SymPy support and ability to draw mathematical expressions using LaTeX! See
  [`st.latex`](api.html#streamlit.latex),
  [`st.markdown`](api.html#streamlit.markdown),
  and
  [`st.write`](api.html#streamlit.write).
- 🌄 You can now set config options using environment variables. For example,
  `export STREAMLIT_SERVER_PORT=9876`.
- 🐱 Ability to call `streamlit run` directly with Github and Gist URLs. No
  need to grab the "raw" URL first!
- 📃 Cleaner exception stack traces. We now remove all Streamlit-specific code
  from stack traces originating from the user's app.

## Version 0.49.0

_Release date: October 23, 2019_

**Highlights:**

- 💯 New input widget for entering numbers with the keyboard: `st.number_input()`
- 📺 Audio/video improvements: ability to load from a URL, to embed YouTube
  videos, and to set the start position.
- 🤝 You can now (once again) share static snapshots of your apps to S3! See
  the S3 section of `streamlit config show` to set it up. Then share from
  top-right menu.
- ⚙️ Use `server.baseUrlPath` config option to set Streamlit's URL to something
  like `http://domain.com/customPath`.

**Notable bug fixes:**

- Fixes numerous Windows bugs, including [Issues
  #339](https://github.com/streamlit/streamlit/issues/399) and
  [#401](https://github.com/streamlit/streamlit/issues/301).

## Version 0.48.0

_Release date: October 12, 2019_

**Highlights:**

- 🔧 Ability to set config options as command line flags or in a local config file.
- ↕️ You can now maximize charts and images!
- ⚡ Streamlit is now much faster when writing data in quick succession to your app.
- ✳️ Ability to blacklist folder globs from "run on save" and `@st.cache` hashing.
- 🎛️ Improved handling of widget state when Python file is modified.
- 🙈 Improved HTML support in `st.write` and `st.markdown`. HTML is still unsafe, though!

**Notable bug fixes:**

- Fixes `@st.cache` bug related to having your Python environment on current
  working directory. [Issue #242](https://github.com/streamlit/streamlit/issues/242)
- Fixes loading of root url `/` on Windows. [Issue #244](https://github.com/streamlit/streamlit/issues/244)

## Version 0.47.0

_Release date: October 1, 2019_

**Highlights:**

- 🌄 New hello.py showing off 4 glorious Streamlit apps. Try it out!
- 🔄 Streamlit now automatically selects an unused port when 8501 is already in use.
- 🎁 Sidebar support is now out of beta! Just start any command with `st.sidebar.` instead of `st.`
- ⚡ Performance improvements: we added a cache to our websocket layer so we no longer re-send data to the browser when it hasn't changed between runs
- 📈 Our "native" charts `st.line_chart`, `st.area_chart` and `st.bar_chart` now use Altair behind the scenes
- 🔫 Improved widgets: custom st.slider labels; default values in multiselect
- 🕵️‍♀️ The filesystem watcher now ignores hidden folders and virtual environments
- 💅 Plus lots of polish around caching and widget state management

**Breaking change:**

- 🛡️ We have temporarily disabled support for sharing static "snapshots" of Streamlit apps. Now that we're no longer in a limited-access beta, we need to make sure sharing is well thought through and abides by laws like the DMCA. But we're working on a solution!

## Version 0.46.0

_Release date: September 19, 2019_

**Highlights:**

- ✨ Magic commands! Use `st.write` without typing `st.write`. See
  https://docs.streamlit.io/en/latest/api.html#magic-commands
- 🎛️ New `st.multiselect` widget.
- 🐍 Fixed numerous install issues so now you can use `pip install streamlit`
  even in Conda! We've therefore deactivated our Conda repo.
- 🐞 Multiple bug fixes and additional polish in preparation for our launch!

**Breaking change:**

- 🛡️ HTML tags are now blacklisted in `st.write`/`st.markdown` by default. More
  information and a temporary work-around at:
  https://github.com/streamlit/streamlit/issues/152

## Version 0.45.0

_Release date: August 28, 2019_

**Highlights:**

- 😱 Experimental support for _sidebar_! Let us know if you want to be a beta
  tester.
- 🎁 Completely redesigned `st.cache`! Much more performant, has a cleaner API,
  support for caching functions called by `@st.cached` functions,
  user-friendly error messages, and much more!
- 🖼️ Lightning fast `st.image`, ability to choose between JPEG and PNG
  compression, and between RGB and BGR (for OpenCV).
- 💡 Smarter API for `st.slider`, `st.selectbox`, and `st.radio`.
- 🤖 Automatically fixes the Matplotlib backend -- no need to edit .matplotlibrc

## Version 0.44.0

_Release date: July 28, 2019_

**Highlights:**

- ⚡ Lightning-fast reconnect when you do a ctrl-c/rerun on your Streamlit code
- 📣 Useful error messages when the connection fails
- 💎 Fixed multiple bugs and improved polish of our newly-released interactive widgets

## Version 0.43.0

_Release date: July 9, 2019_

**Highlights:**

- ⚡ Support for interactive widgets! 🎈🎉

## Version 0.42.0

_Release date: July 1, 2019_

**Highlights:**

- 💾 Ability to save Vega-Lite and Altair charts to SVG or PNG
- 🐇 We now cache JS files in your browser for faster loading
- ⛔ Improvements to error-handling inside Streamlit apps

## Version 0.41.0

_Release date: June 24, 2019_

**Highlights:**

- 📈 Greatly improved our support for named datasets in Vega-Lite and Altair
- 🙄 Added ability to ignore certain folders when watching for file changes. See the `server.folderWatchBlacklist` config option.
- ☔ More robust against syntax errors on the user's script and imported modules

## Version 0.40.0

_Release date: June 10, 2019_

**Highlights:**

- Streamlit is more than 10x faster. Just save and watch your analyses update instantly.
- We changed how you run Streamlit apps:
  `$ streamlit run your_script.py [script args]`
- Unlike the previous versions of Streamlit, `streamlit run [script] [script args]` creates a server (now you don't need to worry if the proxy is up). To kill the server, all you need to do is hit **Ctrl+c**.

**Why is this so much faster?**

Now, Streamlit keeps a single Python session running until you kill the server. This means that Streamlit can re-run your code without kicking off a new process; imported libraries are cached to memory. An added bonus is that `st.cache` now caches to memory instead of to disk.

**What happens if I run Streamlit the old way?**

If you run `$ python your_script.py` the script will execute from top to bottom, but won't produce a Streamlit app.

**What are the limitations of the new architecture?**

- To switch Streamlit apps, first you have to kill the Streamlit server with **Ctrl-c**. Then, you can use `streamlit run` to generate the next app.
- Streamlit only works when used inside Python files, not interactively from the Python REPL.

**What else do I need to know?**

- The strings we print to the command line when **liveSave** is on have been cleaned up. You may need to adjust any RegEx that depends on those.
- A number of config options have been renamed:

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

If the new Streamlit isn't working, please let us know by Slack or email. You can downgrade at any time with these commands:

```bash
$ pip install --upgrade streamlit==0.37
```

```bash
$ conda install streamlit=0.37
```

**What's next?**

Thank you for staying with us on this journey! This version of Streamlit lays the foundation for interactive widgets, a new feature of Streamlit we're really excited to share with you in the next few months.

## Version 0.36.0

_Release date: May 03, 2019_

**Highlights**

- 🚣‍♀️ `st.progress()` now also accepts floats from 0.0–1.0
- 🤯 Improved rendering of long headers in DataFrames
- 🔐 Shared apps now default to HTTPS

## Version 0.35.0

_Release date: April 26, 2019_

**Highlights**

- 📷 Bokeh support! Check out docs for `st.bokeh_chart`
- ⚡️ Improved the size and load time of saved apps
- ⚾️ Implemented better error-catching throughout the codebase
