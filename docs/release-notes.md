# Release Notes

#### v0.8
April 23, 2018
```
We are thrilled to announce the v0.8 of Streamlit. To upgrade, please run:

    pip install --upgrade streamlit

New features are:

1. Help now opens in a separate tab. So running

    python -m streamlit help

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

Remember if you get lost, just run `python -m streamlit help`. We look forward
to hearing how you use these powerful new features!
```

#### v0.6
April 9, 2018

```
We are thrilled to announce the v0.6 of Streamlit. To upgrade, please run:

    pip install --upgrade streamlit

Streamlit now has a built-in help manual! To access it run:

    python -m streamlit help

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

Remember if you get lost, just run `python -m streamlit help`. We look forward
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
