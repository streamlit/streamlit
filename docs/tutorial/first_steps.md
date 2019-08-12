# Tutorial: First steps

Now that you have [already set up Streamlit](/getting_started), open up a
text editor and paste this in:

```python
import streamlit as st

st.write('Hello, world')
```

Now save the file as `helloworld.py` and try running it with Streamlit:

```bash
$ streamlit run helloworld.py
```

This will open a new tab in your web browser, containing a Streamlit _report_.
A report is Streamlit's magical graphical frontend for your programs.

```eval_rst
.. tip::
   We recommend **arranging your browser window and text editor side by side,**
   so you can always see both at the same time.
```

## Making updates

Next, let's try modifying our `helloworld.py` to see what happens. So go ahead and
change the text inside `st.write()` to:

```python
st.write('Hello, **Streamlit**!')
```

Now save the file, and look at your web browser. A message should appear on the
top-right, saying it detected the script has changed, and asking whether you
want to rerun the script once or always rerun it. Click on **Always rerun**.

**...AND BAM!** Now your report says “Hello, Streamlit!” rather than “Hello,
World.” Also the word “Streamlit” is now **bold**. The way we did that was by
adding those asterisks `**` on each side of the word we wanted to bold. That
works because `st.write()` supports Markdown!

And now every time you modify your file and save it, your Streamlit report will
automagically update to match.

## Enter the data

Ok, so far I just showed you how to write some Markdown-formatted text strings
to a report. That's already pretty useful, but we're only getting started
--- there's more awesome on the way!

First up, let's start by preparing a dataset full of random numbers and printing
it to the screen. So add this at the end of `helloworld.py`:

```python
import numpy as np

df = np.random.randn(50, 7)
st.write(df)
```

```eval_rst
.. note::
  From now on, I won't tell you to save your program again. Just assume
  that's what you should do whenever you want your report to update. And right now
  is one of those times: go ahead and save `helloworld.py` to see the latest
  changes!
```

As you can see, you can use `st.write()` on a Numpy array to render a dataset
into a table in your report. What's more, Streamlit also supports plain Python
lists and Pandas datatables.

You can also re-run your program directly from within your web browser.
Just type `r` anytime, or choose "Rerun" from the top-right menu. If you try it
right now, you'll see the random numbers on the table you just created changing
right before your eyes.

OK, so tables are cool and all, but what I really like are axes and lines. Know
what I'm talking about? So let's **draw ourselves a nice line chart** from the
same dataset:

```python
st.line_chart(df)
```

It's that simple.

And if you hover your mouse over the line you'll get a tooltip with the value of
the datapoint your cursor is at.


## Adding some structure

Our report is getting a little complex, so it's a good idea to start splitting
it into different sections. Go ahead and modify your `helloworld.py` so it looks like
this:


```python
import streamlit as st
import numpy as np

st.title('My first Streamlit report')
st.write('Hello, world!')

st.header('Time for some data')
st.write('Here\'s a random dataset:')

df = np.random.randn(500, 3)
st.write(df)

st.write('And here\'s what it looks like:')
st.line_chart(df)
```

In your browser, you'll notice **your report now has a nice title, a header, and
some explanatory text** here and there. It's a good idea to add this kind of
structure to all your reports, so they are more legible both by other people
and by your future self when coming back to a report months later.


## Making progress

Now let's slow things down a bit. By which I mean, let's add a long-running
computation that blocks the rest of the script from executing.

Add this at the end of `helloworld.py`:

```python
st.header('Showing progress')
import time

st.write('Starting a long computation...')
for i in range(100):
  # Pretend this is a computation that takes 100ms to run.
  # We're running it 100 times, so that's 10s total.
  time.sleep(0.1)
st.write('...and now we\'re done!')
```

This is all well and good, but it's somewhat annoying that during the 10s that
it takes for the for loop to run you have no indication what is actually
happening. **Wouldn't it be great if the report could tell you what was
happening inside that long running function?**

Well, it totally can! Just replace the snippet above with:

```python
st.header('Showing progress')
import time

st.write('Starting a long computation...')

# Place some widgets on the page
latest_iteration = st.empty()
bar = st.progress(0)

for i in range(100):
  # Update the widgets in each iteration.
  latest_iteration.text('Iteration %d' % i)
  bar.progress(i + 1)
  time.sleep(0.1)

st.write('...and now we\'re done!')
```

Now re-run the script, scroll to the bottom of the page, and marvel at all the
_progress_ we've made.

Finally, let's **celebrate this occasion** by appending just one last command
to our script:

```python
st.balloons()
```

...and you're now done with your first Streamlit script. Woohoo!


## This is just the beginning

Now you should have a basic idea of how to use Streamlit in your own scripts:
just `import streamlit as st` and experiment away from there! A good way to
start is by copy/pasting code snippets straight from the Streamlit
documentation. Just run `streamlit docs` on a terminal to get to the docs, or
click the *Documentation* item in Streamlit's top-right menu.

**Next up,** we'll run through a more concrete example of how you could use
Streamlit on your day-to-day --- and we'll introduce you to some more advanced
Streamlit commands. Click here for [part 2 of the
tutorial](/tutorial/caching_mapping_more).

## Appendix: the final script

This is what `helloworld.py` should look like when you're done with this tutorial:


```python
import streamlit as st
import numpy as np
import time

st.title('My first Streamlit report')
st.write('Hello, world!')

st.header('Time for some data')
st.write('Here\'s a random dataset:')

df = np.random.randn(500, 3)
st.write(df)

st.write('And here\'s what it looks like:')
st.line_chart(df)

st.header('Showing progress')

import time

st.write('Starting a long computation...')

# Place some widgets on the page
latest_iteration = st.empty()
bar = st.progress(0)

for i in range(100):
  # Update the widgets in each iteration.
  latest_iteration.text('Iteration %d' % i)
  bar.progress(i + 1)
  time.sleep(0.1)

st.write('...and now we\'re done!')
st.balloons()
```
