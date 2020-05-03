# Caching

Streamlit provides a caching mechanism that allows your app to stay performant even when loading data from the web, manipulating large datasets, or performing expensive computations. This is done with the [`@st.cache`](api.html#streamlit.cache) decorator.

When you mark a function with the [`@st.cache`](api.html#streamlit.cache) decorator, it tells Streamlit that whenever the function is called it needs to check a few things:

1. The input parameters that you called the function with
2. The value of any external variable used in the function
3. The body of the function
4. The body of any function used inside the cached function

If this is the first time Streamlit has seen these four components with these exact values and in this exact combination and order, it runs the function and stores the result in a local cache. Then, next time the cached function is called, if none of these components changed, Streamlit will just skip executing the function altogether and, instead, return the output previously stored in the cache.

The way Streamlit keeps track of changes in these components is through hashing. Think of the cache as a simple in-memory key-value store, where the key is a hash of all of the above and the value is the actual output object passed by reference.

Finally, [`@st.cache`](api.html#streamlit.cache) supports arguments to configure the cache's behavior. You can find more information on those in our [API reference](api.md).

Let's take a look at a few examples that illustrate how caching works in a Streamlit app.

## Example 1: Basic usage

For starters, let's take a look at a sample app that has a function that performs an expensive, long-running computation. Without caching, this function is rerun each time the app is refreshed, leading to a poor user experience. Copy this code into a new app and try it out yourself:

```python
import streamlit as st
import time

def expensive_computation(a, b):
    time.sleep(2)  # 👈 This makes the function take 2s to run
    return a * b

a = 2
b = 21
res = expensive_computation(a, b)

st.write("Result:", res)
```

Try pressing **R** to rerun the app, and notice how long it takes for the result to show up. This is because `expensive_computation(a, b)` is being re-executed every time the app runs. This isn't a great experience.

Let's add the [`@st.cache`](api.html#streamlit.cache) decorator:

```python
import streamlit as st
import time

@st.cache  # 👈 Added this
def expensive_computation(a, b):
    time.sleep(2)  # This makes the function take 2s to run
    return a * b

a = 2
b = 21
res = expensive_computation(a, b)

st.write("Result:", res)
```

Now run the app again and you'll notice that it is much faster every time you press R to rerun. To understand what is happening, let's add an st.write inside the function:

```python
import streamlit as st
import time

@st.cache(suppress_st_warning=True)  # 👈 Changed this
def expensive_computation(a, b):
    # 👇 Added this
    st.write("Cache miss: expensive_computation(", a, ",", b, ") ran")
    time.sleep(2)  # This makes the function take 2s to run
    return a * b

a = 2
b = 21
res = expensive_computation(a, b)

st.write("Result:", res)
```

Now when you rerun the app the text "Cache miss" appears on the first run, but not on any subsequent runs. That's because the cached function is only being executed once, and every time after that you're actually hitting the cache.

```eval_rst
.. note::
   You may have noticed that we've added the `suppress_st_warning` keyword to the `@st.cache` decorators. That's because the cached function above uses a Streamlit command itself (`st.write` in this case), and when Streamlit sees that, it shows a warning that your command will only execute when you get a cache hit. More often than not, when you see that warning it's because there's a bug in your code. However, in our case we're using the `st.write` command to demonstrate when the cache is being hit, so the behavior Streamlit is warning us about is exactly what we want. As a result, we are passing in `suppress_st_warning=True` to turn that warning off.
```

## Example 2: When the function arguments change

Without stopping the previous app server, let's change one of the arguments to our cached function:

```python
import streamlit as st
import time

@st.cache(suppress_st_warning=True)
def expensive_computation(a, b):
    st.write("Cache miss: expensive_computation(", a, ",", b, ") ran")
    time.sleep(2)  # This makes the function take 2s to run
    return a * b

a = 2
b = 210  # 👈 Changed this
res = expensive_computation(a, b)

st.write("Result:", res)
```

Now the first time you rerun the app it's a cache miss. This is evidenced by the "Cache miss" text showing up and the app taking 2s to finish running. After that, if you press **R** to rerun, it's always a cache hit. That is, no such text shows up and the app is fast again.

This is because Streamlit notices whenever the arguments **a** and **b** change and determines whether the function should be re-executed and re-cached.

## Example 3: When the function body changes

Without stopping and restarting your Streamlit server, let's remove the widget from our app and modify the function's code by adding a `+ 1` to the return value.

```python
import streamlit as st
import time

@st.cache(suppress_st_warning=True)
def expensive_computation(a, b):
    st.write("Cache miss: expensive_computation(", a, ",", b, ") ran")
    time.sleep(2)  # This makes the function take 2s to run
    return a * b + 1  # 👈 Added a +1 at the end here

a = 2
b = 210
res = expensive_computation(a, b)

st.write("Result:", res)
```

The first run is a "Cache miss", but when you press **R** each subsequent run is a cache hit. This is because on first run, Streamlit detected that the function body changed, reran the function, and put the result in the cache.

```eval_rst
.. tip::
   If you change the function back the result will already be in the Streamlit cache from a previous run. Try it out!
```

## Example 4: When an inner function changes

Let's make our cached function depend on another function internally:

```python
import streamlit as st
import time

def inner_func(a, b):
    st.write("inner_func(", a, ",", b, ") ran")
    return a * b

@st.cache(suppress_st_warning=True)
def expensive_computation(a, b):
    st.write("Cache miss: expensive_computation(", a, ",", b, ") ran")
    time.sleep(2)  # This makes the function take 2s to run
    return inner_func(a, b) + 1

a = 2
b = 210
res = expensive_computation(a, b)

st.write("Result:", res)
```

What you see is the usual:

1. The first run results in a cache miss.
1. Every subsequent rerun results in a cache hit.

But now let's try modifying the `inner_func()`:

```python
import streamlit as st
import time

def inner_func(a, b):
    st.write("inner_func(", a, ",", b, ") ran")
    return a ** b  # 👈 Changed the * to ** here

@st.cache(suppress_st_warning=True)
def expensive_computation(a, b):
    st.write("Cache miss: expensive_computation(", a, ",", b, ") ran")
    time.sleep(2)  # This makes the function take 2s to run
    return inner_func(a, b) + 1

a = 2
b = 21
res = expensive_computation(a, b)

st.write("Result:", res)
```

Even though `inner_func()` is not annotated with [`@st.cache`](api.html#streamlit.cache), when we edit its body we cause a "Cache miss" in the outer `expensive_computation()`.

That's because Streamlit always traverses your code and its dependencies to verify that the cached values are still valid. This means that while developing your app you can edit your code freely without worrying about the cache. Any change you make to your app, Streamlit should do the right thing!

Streamlit is also smart enough to only traverse dependencies that belong to your app, and skip over any dependency that comes from an installed Python library.

## Example 5: Use caching to speed up your app across users

Going back to our original function, let's add a widget to control the value of `b`:

```python
import streamlit as st
import time

@st.cache(suppress_st_warning=True)
def expensive_computation(a, b):
    st.write("Cache miss: expensive_computation(", a, ",", b, ") ran")
    time.sleep(2)  # This makes the function take 2s to run
    return a * b

a = 2
b = st.slider("Pick a number", 0, 10)  # 👈 Changed this
res = expensive_computation(a, b)

st.write("Result:", res)
```

What you'll see:

- If you move the slider to a number Streamlit hasn't seen before, you'll have a cache miss again. And every subsequent rerun with the same number will be a cache hit, of course.
- If you move the slider back to a number Streamlit has seen before, the cache is hit and the app is fast as expected.

In computer science terms, what is happening here is that [`@st.cache`](api.html#streamlit.cache) is [memoizing](https://en.wikipedia.org/wiki/Memoization) `expensive_computation(a, b)`.

But now let's go one step further! Try the following:

1. Move the slider to a number you haven't tried before, such as 9.
2. Pretend you're another user by opening another browser tab pointing to your Streamlit app (usually at http://localhost:8501)
3. In the new tab, move the slider to 9.

Notice how this is actually a cache hit! That is, you don't actually see the "Cache miss" text on the second tab even though that second user never moved the slider to 9 at any point prior to this.

This happens because the Streamlit cache is global to all users. So everyone contributes to everyone else's performance.

## Example 6: Mutating cached values

As mentioned in the [overview](#caching) section, the Streamlit cache stores items by reference. This allows the Streamlit cache to support structures that aren't memory-managed by Python, such as TensorFlow objects. However, it can also lead to unexpected behavior — which is why Streamlit has a few checks to guide developers in the right direction. Let's look into those checks now.

Let's write an app that has a cached function which returns a mutable object, and then let's follow up by mutating that object:

```python
import streamlit as st
import time

@st.cache(suppress_st_warning=True)
def expensive_computation(a, b):
    st.write("Cache miss: expensive_computation(", a, ",", b, ") ran")
    time.sleep(2)  # This makes the function take 2s to run
    return {"output": a * b}  # 👈 Mutable object

a = 2
b = 21
res = expensive_computation(a, b)

st.write("Result:", res)

res["output"] = "result was manually mutated"  # 👈 Mutated cached value

st.write("Mutated result:", res)
```

When you run this app for the first time, you should see three messages on the screen:

- Cache miss (...)
- Result: {output: 42}
- Mutated result: {output: "result was manually mutated"}

No surprises here. But now notice what happens when you rerun you app (i.e. press **R**):

- Result: {output: "result was manually mutated"}
- Mutated result: {output: "result was manually mutated"}
- <Warning> Cached object mutated. (...)

So what's up?

What's going on here is that Streamlit caches the output `res` by reference. When you mutated `res["output"]` outside the cached function you ended up inadvertently modifying the cache. This means every subsequent call to `expensive_computation(2, 21)` will return the wrong value!

Since this behavior is usually not what you'd expect, Streamlit tries to be helpful and show you a warning, along with some ideas about how to fix your code.

In this specific case, the fix is just to not mutate `res["output"]` outside the cached function. There was no good reason for us to do that anyway! Another solution would be to clone the result value with `res = deepcopy(expensive_computation(2, 21))`. Check out the section entitled [Fixing caching issues](troubleshooting/caching_issues.md) for more information on these approaches and more.

## Next steps

- [Advanced caching](advanced_caching.md)
