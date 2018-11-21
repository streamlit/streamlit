# Release Notes


#### v0.18.1
November 12, 2018
```
Hey. It's Monday and a new version of the Streamlit, 0.18.1 is out!
To upgrade, please run:

   pip install --upgrade streamlit

This is a minor upgrade with two new features.

1. You can now have Streamlit automatically save a report on close. To do
   so, please set the following setting in ~/.streamlit/config.yaml:

   proxy:
     saveOnExit: True

   IMPORTANT: Please make sure that sharing is set up properly, or this will throw an exception after you code completes.

2. Running streamlit help now creates a report named "help".
```

#### v0.16.1
October 2, 2018
```
Version 0.16 of Streamlit is fresh off the oven with better AWS supppert,
audio/video support, wide mode, and more! Get it while it's hottt 🔥

To upgrade, please run:

   pip install --upgrade streamlit

IMPORTANT: With this version, we start remotely logging statistics about how
often you use different Streamlit features. These will be used to help improve
our product and help us understand how we're growing. If you'd like to opt out,
add the following 2 lines to ~/.streamlit/config.yaml:

client:
  remotelyTrackUsage: False

Other than that, here's what else is new in this release:

1. Easier to use in AWS! Streamlit now auto-configures itself for use
   on AWS. No more juggling config files to get Streamlit to work.

2. We added support for audio and video in Streamlit reports with
   st.audio(audio_bytes, format='audio/wav') and
   st.video(video_bytes, format='video/mp4'). To see code examples, run:

     streamlit help

3. Go big or go home: you can now make your reports wider by clicking on the
   hamburger menu, then "Settings" > "Show reports in wide mode".

4. Introduced a new command to close Streamlit's background process, in the
   unlikely event it's misbehaving: just run:

     streamlit kill_proxy

5. Published some tutorials at http://streamlit.io/docs

6. Fixed a few important bugs, such as Vega Lite support in Python 2.7, support
   for argument-free @st.cache, and support for tiny scripts that end before the Streamlit proxy has a chance to start.
```

#### v0.14.2
August 16, 2018
```
We are thrilled to announce version 0.14 of Streamlit including public saving,
fast script rerunning, and more! To upgrade, please run:

    pkill -9 -f streamlit.proxy # make sure the old proxy isn't running
    pip install --upgrade --no-cache-dir streamlit

See our beautiful new docs!

    http://streamlit.io/docs

Get complete help and API documentation:

    streamlit help

New features are:

1. Anyone can now publicly share Streamlit reports! You all get unlimited free
   cloud space to share your beautiful reports (at least for now while we're
   in beta). Just click "Save Report" in the upper-right-hand menu.

2. You can now rerun you scripts from within the Streamlit interface -- a
   buttery smooth and lightning fast new eval-run interaction. Just type 'r'
   from the Streamlit webpage (or shift+r to change command line arguments).
   You can also access these options from the menu.

3. Streamlit not supports Vega Lite charts (including zoomable charts)! Check
   out the power and beauty of this powerful library here:

     https://vega.github.io/vega-lite/examples/

   See examples of the use of Vega Lite in Streamlit by running

     streamlit help

4. Caching with @st.cache is now orders-of-magnitudes faster. You can now
   skip redundant data fetches and computation even faster!

5. Matplotlib support with st.pyplot() now lets you pass an explicit plot
   argument.

6. Running Streamlit remotely (say in AWS)? We improved auto-detection of the
   server's IP. If that doesn't work, you can also manually set the IP by
   setting:

     proxy:
       externalIP: EXTERNAL_IP_ADDRESS

  in your ~/.streamlit/config.yaml.

7. We fixed a serious bug which caused Streamlit to hang when using the
   latest version of tornado.

Please enjoy and we always love feedback!
```


#### v0.13
July 20, 2018
```
We are thrilled to announce version 0.13 of Streamlit. To upgrade, please run:

    pip install --upgrade --no-cache-dir streamlit

Get complete help and API documentation with:

    streamlit help

New features are:

1. Streamlit now supports remote operation! Get all the buttery goodness of
   Streamlit from AWS instances or in your private cloud. To do this:

     1. Install streamlit on your cloud instance (as shown above).
     2. Add the following to your ~/.streamlit/config.yaml:

          proxy:
            isRemote: true
            waitForConnectionSecs: 60

2. Saving static reports to S3 and loading them is now progressive and much
   faster!

3. There were also numerous bug fixes, including one which causes st.cache() to
   hang.

Please enjoy and we always love feedback!
```

#### v0.12
June 25, 2018
```
We are thrilled to announce version 0.12 of Streamlit. To upgrade, please run:

    pip install --upgrade --no-cache-dir streamlit

Get complete help and API documentation with:

    streamlit help

MAJOR API CHANGE!

We have deprecated the `streamlit.io` package. Please import Streamlit like so:

    import streamlit as st

    st.write(...) etc.

The `streamlit.io` package will be removed in future versions of Streamlit.

New features are:

1. Streamlit now supports Matplotlib! Please use st.pyplot() where you would
   normally use plt.show()

3. Streamlit now runs on Python 2.7.10 and above!

3. You can now save reports to Amazon S3. Please contact Adrien at
   adrien.g.treuille@gmail.com to set this up.

4. If your text editor supports go-to-definition for functions and classes,
   these now work properly for functions in the `streamlit` package.

Bug fixes are:

1. Debug logging messages no longer displayed when Streamlit is launched.

2. You can now pass an array of PIL images to st.image().

3. Streamlit provides more intelligent warnings when floating point arrays are
   passed to st.image() whose bounds are not on the range [0, 1].
```


#### v0.11
June 8, 2018
```
We are thrilled to announce version 0.11 of Streamlit. To upgrade, please run:

    pip install --upgrade --no-cache-dir streamlit

Get complete help and API documentation with:

    streamlit help

New features and bug fixes are:

1. You can now get help within the UI. Click the hamburger icon in the upper
   right-hand corner.

2. We changed the default color palette for charts to make them more readable.

3. DataFrames now render properly when the number of columns change.

4. Fixed a crash when rending DataFrame MultiIndices including Nones.

5. Images with alpha channels now display correctly using io.image.

Streamlit also now supports saving to S3 and GCS buckets however this
functionality is not yet exposed. Please contact @adrien if you're interested
in testing this.
```

#### v0.9
May 17, 2018
```
We are thrilled to announce version 0.9 of Streamlit. To upgrade, please run:

    pip install --upgrade --no-cache-dir streamlit

Check the version with:

    streamlit version

Get complete help and API documentation with:

    streamlit help

New features are:

1. Inline code blocks. Display code blocks inline with io.echo(). For example:

     with io.echo():
       io.write('Hello, world!')

   This will first display the entire code block within the `with` scope, then
   write "Hello, world!"

2. Table support. (EXPERIMENTAL!) You can now display Numpy Arrays and Pandas
   DataFrames as tables using the io.table() call:

     io.table(df)

   This is useful for copy-and-pasting table data.

3. Map support. (EXPERIMENTAL!) You can now display dots on a map with:

     io.map(df)

   This plots as many points as there are rows, using 'lat' and 'lon' to
   determine point locations.

4. Streamlit is now much faster! Speed has improved when passing big tables,
   especially those containing DateTimes.

5. Better support for "interactive Streamlit usage." When you rerun the same
   (possibly changed) script, elements stay cached on the page when possible.

6. Tuple indices now display properly.
```

#### v0.8
April 23, 2018
```
We are thrilled to announce the v0.8 of Streamlit. To upgrade, please run:

    pip install --upgrade streamlit

New features are:

1. Help now opens in a separate tab. So running

    streamlit help

  opens a new tab named "help." Useful for flipping between help and
  your work!

2. Bar charts now show category labels correctly.

3. Streamlit now supports running multiple scripts simultaneously. If you have
   scripts called script_a.py and script_b.py then running:

    python script_a.py
    python script_b.py

  will open two separate tabs called "script_a" and "script_b." Of course,
  updating and rerunning either script will affect only its tab.

4. Float64Index is now supported.

5. We have preliminary support for printing reports. Just use your browser's
   print function.

In addition, we have a couple bug fixes:

1. Non-string input can now be passed into header functions (title(),
   header(), and subheader()) and notification functions (error(), warning(),
   info(), and success()). For example, this works:

     io.header(11)

2. Exceptions will be printed to the report even before the first call to an
   io.* function.

Remember if you get lost, just run `streamlit help`. We look forward
to hearing how you use these powerful new features!
```

#### v0.6
April 9, 2018

```
We are thrilled to announce the v0.6 of Streamlit. To upgrade, please run:

    pip install --upgrade streamlit

Streamlit now has a built-in help manual! To access it run:

    streamlit help

Other new features include:

1. Streamlit functions are available globally in the `io` package. For example:

    from streamlit import io
    io.write('Hello world.')

2. Markdown is now the default for write(). Try:

    io.write('*Italics* **Bold** `Fixed-width`')
    io.text('This is fixed-width text.')

3. We simplified the header functions. Try:

    io.title('A big header.')
    io.header('A smaller header.')
    io.subheader('An even smaller header.')

4. We simplified alerts with the following four new functions:

    io.error('OMG!')
    io.warning('OMG!')
    io.info('OMG!')
    io.success('OMG!')

5. You can now pretty-print your own exceptions:

    io.exception(my_exception)

6. You can now get help on any function, class or package using io.help(). For
   example, for help with with Python's print() function, use:

    io.help(print)

7. We support out-of-order printing with the empty() function. For example,
   to print the first three letters of the alphabet you can do:

    io.markdown('A')
    placeholder = io.empty()
    io.markdown('C')
    placeholder.markdown('B')

8. Show the user something during a long-running computation as follows:

    with spinner(‘wait for it...'):
      long_computation()

    (You can also use the @streamlit.cache decorator to speed these up!)

Remember if you get lost, just run `streamlit help`. We look forward
to hearing how you use these powerful new features!
```

#### v0.5
April 4, 2018

```
We are thrilled to announce the v0.5 of Streamlit. To upgrade, please run:

  pip install --upgrade streamlit

The major new feature in this version is caching! This allows you to quickly
run your script over and over by saving the results of long computations:

  import streamlit

  @streamlit.cache
  def long_running_computation(*args, **kwargs):
    ...

  result = long_running_computation(...)

Your first call to long_running_computation could be slow, but future calls
with the same arguments will return almost instantaneously.

NOTE: Make sure your cached functions depend only on their inputs! For
example, don't cache calls to API endpoints that may give changing results. If
you get into trouble, you can clear the cache on the command line as follows:

  python -m streamlit clear_cache

We look forward to hearing how you use this powerful feature!
```

#### v0.4
April 4, 2018
```
This version has a bug in it and should be skipped.
```

#### v0.3
April 2, 2018

```
We are thrilled to announce the v0.3 of Streamlit. To upgrade, please run:

  pip install --upgrade streamlit

New features include:

1. A beautiful new UI designed by Thiago Teixeira.

2. Support for datetime and timedelta Pandas types.

3. A new simplified charting API. Please use:

     write.line_chart
     write.area_chart
     write.bar_chart

   You can see more examples in periodic_table.py.

4. Fixed a bug when displaying DataFrames with multiple columns having
   the same name.
```
