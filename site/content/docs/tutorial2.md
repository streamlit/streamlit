---
title: "Tutorial part 2"
draft: true
---

At this point, you have probably [already set Streamlit
up](/docs/getting_started/), and even created [your first Streamlit
report](/docs/tutorial). So now let's get down to a more concrete example of 
how you'd use Streamlit when trying to accomplish a real world task.

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
data_load_state = set.write('Loading data...')
data = load_data(100000)
data_load_state.write('Loading data... done!')
```

Well, that's... _underwelming_ ☹

Turns out, downloading the data takes a long time. Who knew?! And converting the
date column to datetime costs us another huge chunk time. That's quite annoying.

And just to show you exactly _how annoying_ this is, let's go ahead and **take a
look at the data we just loaded**:

```python
st.subheader(f'Raw data')
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

And then rerun the script.

Since this is the first time you're running the script with `@st.cache` in it,
you'll see no change. But let's continue tweaking our file so you can see what
happens next.

Append this:

```python
st.write('Now with cache!')
```

...then rerun the script and notice how **the line you just added appears
_immediately_**.

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

A basic question you might ask is, "_what are Uber's busiest hours?_" To answer,
let's break down all the pickup times into at histogram, binned by hour:

```python
st.subheader(f'Number of pickups by hour')
hist_values = np.histogram(filtered_data.dt.hour, bins=12, range=(0,12))[0]
st.bar_chart(hist_values)
```

Rerun the script, and a histogram will appear immediately (thanks, cache!)

## Drawing a map

```python
st.subheader(f'Map of all pickups')
st.map(filtered_data)
```

## Filtering by hour

```python
# Some number in the range 0-23
hour_to_filter = 12
filtered_data = data[data[DATE_COLUMN].dt.hour == hour_to_filter]

st.subheader(f'Raw data at {hour_to_filter}h')
st.write(filtered_data)

st.subheader(f'Number of pickups by minute at {hour_to_filter}h')
st.bar_chart(np.histogram(filtered_data.dt.minute, bins=60, range=(0,60))[0])

st.subheader(f'Map of all pickups at {hour_to_filter}h')
st.map(filtered_data)
```

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

data = load_data(100000)

st.subheader(f'Raw data')
st.write(data)

st.subheader(f'Number of pickups by hour')
st.bar_chart(np.histogram(filtered_data.dt.hour, bins=12, range=(0,12))[0])

st.subheader(f'Map of all pickups')
st.map(filtered_data)

# Some number in the range 0-23
hour_to_filter = 12
filtered_data = data[data[DATE_COLUMN].dt.hour == hour_to_filter]

st.subheader(f'Raw data at {hour_to_filter}h')
st.write(filtered_data)

st.subheader(f'Number of pickups by minute at {hour_to_filter}h')
st.bar_chart(np.histogram(filtered_data.dt.minute, bins=60, range=(0,60))[0])

st.subheader(f'Map of all pickups at {hour_to_filter}h')
st.map(filtered_data)
```
