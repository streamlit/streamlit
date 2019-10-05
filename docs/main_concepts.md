# Main concepts

Working with Streamlit is simple. First you sprinkle a few Streamlit commands into a normal Python script. Then you run the script: `streamlit run your_script.py [script args]`.

As soon as you run the script, a new tab will open in your default browser and connect to a Streamlit server that's automatically launched behind the scenes. In the tab, you'll find your Streamlit app. This is your canvas, where you'll draw charts, text, tables, and more.

What gets drawn in the app is up to you. For example [`st.text`](apid.html#streamlit.text) writes raw text to your app, and [`st.line_chart`](api.html#streamlit.line_chart) draws — you guessed it — a line chart.

## Data flow

Every time you want to update your app, just save your script. The Streamlit server is listening, and will automatically update the report as needed.

Behind the scenes, Streamlit re-executes the entire Python script from top to bottom on each save. Then Streamlit does a bunch of computer-science magic to make sure that your report is updated efficiently. If you're wondering how we deal with non-trivial code, the answers is [`@st.cache`](#caching), which we'll cover in the next section.

What this all means is that Streamlit allows you to work in a fast interactive loop: you type some code, save, type some more code, save, and on-and-on until you're happy with your app. The idea is to use Streamlit as a place where you can understand your code, debug it, perfect it, and finally share your results.

## Caching

Caching is super important when it comes to speed - especially when dealing with large data sets. It's always a good idea to load data, cache what's expensive, visualize the data, then spruce things up with interaction.

Streamlit's ability to quickly update and re-execute the the whole app is great when you're working with a trivial amount of data, but when you have long-running computations, this can get costly and time consuming. Instead of re-executing, you can safely reuse data with [`st.cache`](api.html#streamlit.cache). `st.cache` is a data store that lets Streamlit apps safely and effortlessly persist information.

When you mark a function with Streamlit's cache annotation, it tells Streamlit that whenever the function is called that it needs to check three things:

1. The actual bytecode that makes up the body of the function
2. Code, variables, and files that the function depends on
3. The input parameters that you called the function with

If this is the first time Streamlit has seen these items, with these exact values, and in this exact combination/order, it runs the function and stores the result in a local cache. The next time the function is called, if the values haven't changed, then Streamlit knows it can skip executing the function altogether. Instead, it reads the output from the local cache and passes it on to the caller – like magic.

"But, wait a second," you're saying to yourself, "this sounds too good to be true. What are the limitations of all this awesomesauce?"

Well, there are a few:

1. Streamlit will only check for changes within the current working directory. This means that Streamlit only detects code updates inside installed Python libraries.
2. If your function is not deterministic (its output depends on random numbers), or if it pulls data from an external time-varying source (for example, a live stock market ticker service) the cached value won't know when things have changed.
3. Lastly, you should not mutate the output of a cached function since cached values are stored by reference (for performance reasons and to be able to support libraries such as TensorFlow). Don't worry, Streamlit is smart enough to detect these mutations and show a loud warning explaining how to fix the problem.

While these limitations are important to keep in mind, most of the time, they aren't an issue. The times that these rules apply, caching is really transformational.

## Widgets

When you've got the data or model into the state that you want to explore, you can add in widgets like [`st.slider()`](api.html#streamlit.slider), [`st.button()`](api.html#streamlit.button) or [`st.selectbox()`](api.html#streamlit.selectbox). It's really straightforward - just treat widgets as variables. There are no callbacks in Streamlit! Every interaction simply reruns the script from top-to-bottom. Streamlit assigns each variable an up-to-date value given the app state. This approach leads to really clean code:

```
import streamlit as st
x = st.slider('x')
st.write(x, 'squared is', x * x)

```

## App model

Now that you have an idea of what Streamlit is, let's close the loop and review how it works:

1. The entire script is rerun with each save.
2. Streamlit assigns each variable an up-to-date value based on the current state of the app.
3. Caching allows Streamlit to skip redundant data fetches and computation.

![](media/app_model.png)

## Next steps

- [Get started](getting_started.md) with Streamlit
- Read up on [advanced concepts](advanced_concepts.md)
- [Build your first app ](tutorial/index.md)
