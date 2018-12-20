---
title: "Streamlit tutorial: caching, mapping, and more!"
weight: 101
---

*If you hit any issues going through this tutorial, check out our [Help](/docs/help/) page.*

At this point, you have probably [already set up Streamlit](/docs/installation/),
and even created [your first Streamlit report](/docs/tutorial). So now let's get down to a more
concrete example of how you'd use Streamlit when trying to accomplish a real world task.

## The task

A few years ago, the city of New York asked Uber to publish a dataset with
information about their pickups and dropoffs. I don't know about you, but to me
that sounds like an awesome trove of data --- let's use Streamlit to take a
quick look at it!

First, **create a new file called `uber_pickups.py`** and paste the following
imports into it:

```python
import streamlit as st
import pandas as pd
import numpy as np
```

Now let's make this thing official by giving it a title...

```python
st.title('Uber pickups in NYC')
```

...and then running the script.

As usual, **when you run the script your Streamlit report will automatically pop
up in your browser**. Of course, at this point it's just a blank canvas.

_**REMINDER:** We recommend **arranging your browser window and text editor side
by side,** so you can always see both at the same time._


## Fetching some data

Now let's write a function that loads the data for us:

```python
DATE_COLUMN = 'date/time'
DATA_URL = ('https://s3-us-west-2.amazonaws.com/'
            'streamlit-demo-data/uber-raw-data-sep14.csv.gz')

def load_data(nrows):
    data = pd.read_csv(DATA_URL, nrows=nrows)
    lowercase = lambda x: str(x).lower()
    data.rename(lowercase, axis='columns', inplace=True)
    data[DATE_COLUMN] = pd.to_datetime(data[DATE_COLUMN])
    return data
```

As you can see, `load_data` is just a plain old function that downloads some
data, puts it in a Pandas dataframe, and converts the date column from text to
datetime. It accepts a parameter `nrows`, which specifies the number of rows to
load into the dataframe.

So let's try out this function and see what happens:

```python
data_load_state = st.text('Loading data...')
data = load_data(10000)
data_load_state.text('Loading data... done!')
```

Well, that's... _underwelming_ ☹

Turns out, downloading the data takes a long time. Who knew?! And converting the
date column to datetime costs us another huge chunk time. That's quite annoying.

And just to show you exactly _how annoying_ this is, let's go ahead and **take a
look at the data we just loaded**:

```python
st.subheader('Raw data')
st.write(data)
```

...ugh. Another. Long. Wait.

Wouldn't it be amazing if we could **avoid repeating this lenghty step** every
time we re-ran the script?

Streamlit to the rescue! Let's have a conversation about caching.


## Magical caching

Try prepending `@st.cache` before the `load_data` declaration, so it looks like
this:

```python
@st.cache
def load_data(nrows):
```

And then just save the script to have Streamlit automatically rerun it for you.

Since this is the first time you're running the script with `@st.cache` in it,
you'll see no change. But let's continue tweaking our file so you can see what
happens next.

Replace the line `st.write('Done!')` with this:

```python
st.write('Done! (using st.cache)')
```

...then save and notice how **the line you just added appears _immediately_**.

If you take a step back for a second, this is actually quite amazing. Something
magical is happening behind the scenes, and it's just a single line of code to
activate it.

### But _how_?

Let me go into a sidebar at this point and tell you how `@st.cache` actually
works.

When you mark a function with Streamlit's cache annotation, it tells Streamlit
that whenever the function is called it should check three things:

1. The name of the function
1. The actual code that makes up the body of the function
1. The input parameters that you called the function with

If this is the first time Streamlit has seen those three items, with those exact
values, and in that exact combination, it runs the function and stores the
result in a local cache.

Then, next time the function is called, if those three values have not changed
Streamlit knows it can skip executing the function altogether. Instead, it just
reads the output from the local cache and passes it on to the caller.

Bam! Like magic.

"_But, wait a second,_" you're thinking, "_this sounds too good. What are the
limitations of all this awesomesauce?_"

The main limitation is related to item #2, above. That is, Streamlit's cache
feature doesn't know about changes that take place outside the body of the
annotated function.

For example, the `load_data` function above depends on a couple of global
variables. If we change those variables, Streamlit will have no knowledge of
that and will keep returning the cached output as if they never changed to begin
with.

Similarly, if the annotated function depends on code that lives outside of it,
and that outside code changes, the cache mechanism will be none-the-wiser. Same
if the function reads a dataset from a URL, and the remote dataset is
time-varying.

These limitations are important to keep in mind, but tend not to be an issue
a surprising amount of times. Those times, this cache is really
transformational.

So if nothing else, here's what you should take from this tutorial:

_**PRO TIP:** Whenever you have a long-running computation in your code,
consider refactoring it so you can use_ `@st.cache`_, if possible._

---

OK, sidebar over. Now that you know how the cache mechanism works, let's get
back to the task at hand: understanding Uber's passenger pickup patterns in NYC.

## Drawing a histogram

A basic question you might ask is "_what are Uber's busiest hours?_" To answer
that, let's break down all the pickup times into at histogram, binned by hour:

```python
st.subheader('Number of pickups by hour')
hist_values = np.histogram(data[DATE_COLUMN].dt.hour, bins=24, range=(0, 24))[0]
st.bar_chart(hist_values)
```

Save the script and a histogram will appear immediately.
What the chart tells us is that **Uber is busiest around 17:00 (i.e. 5pm)**.
Cool!


## Dots on a map

Now let's see what all those pickups look like when overlaid on top of a map of
NYC:

```python
st.subheader('Map of all pickups')
st.map(data)
```

**Yes, really. Drawing a map is _that_ simple.** Just call `st.map` and pass in
a datset where come column is named `lat` and another `lon`.

And since this is not the 90s, the map is interactive: go ahead and try panning
and zooming it a bit!

But let's do one better. In the previous section, we learned that the peak Uber
hour is 17:00, so you may be wondering "what are the peak Uber _locations_ at 5pm?"

Well, that should be easy to find out: just filter the map to show only pickups
between 5--6pm and find out.

So replace the previous snippet with the following:

```python
# Some number in the range 0-23
hour_to_filter = 17
filtered_data = data[data[DATE_COLUMN].dt.hour == hour_to_filter]

st.subheader('Map of all pickups at %d:00' % hour_to_filter)
st.map(filtered_data)
```

And we're done!

Looks like **Uber's prime real estate at that time is Midtown, slightly
off-center toward the East side**. Groovy!


## Appendix: the final script

This is what `uber_pickups.py` should look like when you're done with this
tutorial:

```python
import streamlit as st
import pandas as pd
import numpy as np

st.title('Uber pickups in NYC')

DATE_COLUMN = 'date/time'
DATA_URL = ('https://s3-us-west-2.amazonaws.com/'
            'streamlit-demo-data/uber-raw-data-sep14.csv.gz')

@st.cache
def load_data(nrows):
    data = pd.read_csv(DATA_URL, nrows=nrows)
    lowercase = lambda x: str(x).lower()
    data.rename(lowercase, axis='columns', inplace=True)
    data[DATE_COLUMN] = pd.to_datetime(data[DATE_COLUMN])
    return data

st.write('Loading data...')
data = load_data(10000)
st.write('Done! (using st.cache)')

st.subheader('Raw data')
st.write(data)

st.subheader('Number of pickups by hour')
hist_values = np.histogram(data[DATE_COLUMN].dt.hour, bins=24, range=(0,24))[0]
st.bar_chart(hist_values)

# Some number in the range 0-23
hour_to_filter = 17
filtered_data = data[data[DATE_COLUMN].dt.hour == hour_to_filter]

st.subheader('Map of all pickups at %d:00' % hour_to_filter)
st.map(filtered_data)
```
