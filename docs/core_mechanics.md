# Core mechanics

Working with Streamlit is simple: first you sprinkle a few _Streamlit
commands_ into a normal Python script, and then you run the script
with `streamlit run your_script.py [script args]`.

This causes a new tab to pop up in your default web browser, connected to a
special Streamlit server that automatically launched behind the scenes.

In the browser tab lives your _Streamlit report_. The report is the canvas
where charts, text, tables, and all other elements are drawn. You can share
reports, send someone a link, and have them open the link on any browser.

What exactly gets drawn in the report is up to you. Each command draws a
different element in the report. For example the
[`st.text`](api.html#streamlit.text)
command writes pure text to the report, and
[`st.line_chart`](api.html#streamlit.line_chart) draws — you guessed it
— a line chart.  The swiss army knife of Streamlit commands is
[`st.write`](api.html#streamlit.cache), which we'll get to later.

## Updating the report

Every time you want to update your report, you just save your script
and the Streamlit server will automatically notice it and update the report
as needed.

What happens behind the scenes every time you save the file is Streamlit
re-executes the entire Python script normally, from top to bottom. And
then it does a bunch of computer-sciencey magic to make sure the report
gets updated in an optimal way. (Skipping ahead a bit, if you're interested
in this kind of stuff, take a look at the
[`st.cache`](api.html#streamlit.cache) command for additional ways to
optimize your reports.)

In sum, Streamlit allows you to work in a fast interactive loop: that is, you
type some code, save, type some more, save, type type, save, and so on,
until you're happy with the results. The idea is to use the Streamlit
report as a place where you can understand your code, debug it, perfect it,
and finally share your results with your peers.

## Appending elements to a report

All drawing commands in the `streamlit` module _append_ elements to your
Streamlit report.

```python
st.write('''
    We analyze the stock market using some tried-and-true _FooBarian_ model
    analysis, with parameters _blorg_ and _bleep_ set to `0` and `1`
    initially.  Then we optimize them by _frobnicating_ the _plumbus_.
''')
# Appends a paragraph to the report.

my_data = np.random.randn(100, 2)

st.line_chart(my_data)
# Appends a chart to the report.
```

## Redrawing/replacing elements in a report

All of Streamlit's drawing commands (with the exception of `st.write`) return
an object that can be used to update/redraw that element:

```python
my_element = st.text('Hey there')
# Draws "Hey there" in the Streamlit report,
# and saves that "slot" in the report so it can be reused.

my_element.text('Hello world')
# Replaces "Hey there" with "Hello world" in the Streamlit report.
```

You can also replace one element with another of a completely different
type. For instance, in the snippet below an [`st.text`](api.html#text)
element gets replaced with an [`st.dataframe`](api.html#dataframe).

```python
data_element = st.text('Loading data...')
# Draws "Loading data..." in the Streamlit report.

df = load_huge_dataframe_from_internet()

data_element.dataframe(df)
# Replaces "Loading data..." with a table containing the actual data.
```

This replacement mechanism allows you to easily create animations in
Streamlit as explained in the _Animating elements_ section, below.

## Inserting elements out of order

You can use the [`st.empty`](api.html#streamlit.empty) command so you can
"save" a slot in your report for use later on.

```python
st.text('This will appear first')
# Appends some text to the report.

my_slot1 = st.empty()
# Appends an empty slot to the report. We'll use this later.

my_slot2 = st.empty()
# Appends another empty slot.

st.text('This will appear last')
# Appends some more text to the report.

my_slot1.text('This will appear second')
# Replaces the first empty slot with a text string.

my_slot2.line_chart(np.random.randn(20, 2))
# Replaces the second empty slot with a chart.
```

## Appending data to a chart or table.

In Streamlit, you can not only replace entire elements in your report, but also
modify the data behind those elements. Here is how:

```python
import numpy as np
import time

# Get some data.
data = np.random.randn(10, 2)

# Show the data as a chart.
chart = st.line_chart(data)

# Wait 1 second, so the change is clearer.
time.sleep(1)

# Grab some more data.
data2 = np.random.randn(10, 2)

# Append the new data to the existing chart.
chart.add_rows(data2)
```

## Animating elements

If you put together all the tools you learned about above you can create
compelling animations using Streamlit. Just replace elements in the report or
update their data every so often. For example:

```python
progress_bar = st.progress(0)
status_text = st.empty()
chart = st.line_chart(np.random.randn(10, 2))

for i in range(100):
    # Update progress bar.
    progress_bar.progress(i)

    new_rows = np.random.randn(10, 2)

    # Update status text.
    status_text.text(
        'The latest random number is: %s' % new_rows[-1, 1])

    # Append data to the chart.
    chart.add_rows(new_rows)

    # Pretend we're doing some computation that takes time.
    time.sleep(0.1)

status_text.text('Done!')
st.balloons()
```

You can see this example live by running `streamlit hello` on your command
line.
