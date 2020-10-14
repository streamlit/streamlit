# Improve app performance

Streamlit provides a caching mechanism that allows your app to stay performant even when loading data from the web, manipulating large datasets, or performing expensive computations. This is done with the [`@st.cache`](api.html#streamlit.cache) decorator.

When you mark a function with the [`@st.cache`](api.html#streamlit.cache) decorator, it tells Streamlit that whenever the function is called it needs to check a few things:

1. The input parameters that you called the function with
2. The value of any external variable used in the function
3. The body of the function
4. The body of any function used inside the cached function

If this is the first time Streamlit has seen these four components with these exact values and in this exact combination and order, it runs the function and stores the result in a local cache. Then, next time the cached function is called, if none of these components changed, Streamlit will just skip executing the function altogether and, instead, return the output previously stored in the cache.

The way Streamlit keeps track of changes in these components is through hashing. Think of the cache as an in-memory key-value store, where the key is a hash of all of the above and the value is the actual output object passed by reference.

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

## Advanced caching

In [caching](caching.md), you learned about the Streamlit cache, which is accessed with the [`@st.cache`](api.html#streamlit.cache) decorator. In this article you'll see how Streamlit's caching functionality is implemented, so that you can use it to improve the performance of your Streamlit apps.

The cache is a key-value store, where the key is a hash of:

1. The input parameters that you called the function with
1. The value of any external variable used in the function
1. The body of the function
1. The body of any function used inside the cached function

And the value is a tuple of:

- The cached output
- A hash of the cached output (you'll see why soon)

For both the key and the output hash, Streamlit uses a specialized hash function that knows how to traverse code, hash special objects, and can have its [behavior customized by the user](#the-hash-funcs-parameter).

For example, when the function `expensive_computation(a, b)`, decorated with [`@st.cache`](api.html#streamlit.cache), is executed with `a=2` and `b=21`, Streamlit does the following:

1. Computes the cache key
1. If the key is found in the cache, then:
   - Extracts the previously-cached (output, output_hash) tuple.
   - Performs an **Output Mutation Check**, where a fresh hash of the output is computed and compared to the stored `output_hash`.
     - If the two hashes are different, shows a **Cached Object Mutated** warning. (Note: Setting `allow_output_mutation=True` disables this step).
1. If the input key is not found in the cache, then:
   - Executes the cached function (i.e. `output = expensive_computation(2, 21)`).
   - Calculates the `output_hash` from the function's `output`.
   - Stores `key → (output, output_hash)` in the cache.
1. Returns the output.

If an error is encountered an exception is raised. If the error occurs while hashing either the key or the output an `UnhashableTypeError` error is thrown. If you run into any issues, see [fixing caching issues](troubleshooting/caching_issues.md).

### The `hash_funcs` parameter

As described above, Streamlit's caching functionality relies on hashing to calculate the key for cached objects, and to detect unexpected mutations in the cached result.

For added expressive power, Streamlit lets you override this hashing process using the `hash_funcs` argument. Suppose you define a type called `FileReference` which points to a file in the filesystem:

```Python
class FileReference:
    def __init__(self, filename):
        self.filename = filename


@st.cache
def func(file_reference):
    ...
```

By default, Streamlit hashes custom classes like `FileReference` by recursively navigating their structure. In this case, its hash is the hash of the filename property. As long as the file name doesn't change, the hash will remain constant.

However, what if you wanted to have the hasher check for changes to the file's modification time, not just its name? This is possible with [`@st.cache`](api.html#streamlit.cache)'s `hash_funcs` parameter:

```Python
class FileReference:
    def __init__(self, filename):
        self.filename = filename

def hash_file_reference(file_reference):
    filename = file_reference.filename
    return (filename, os.path.getmtime(filename))

@st.cache(hash_funcs={FileReference: hash_file_reference})
def func(file_reference):
    ...
```

Additionally, you can hash `FileReference` objects by the file's contents:

```Python
class FileReference:
    def __init__(self, filename):
        self.filename = filename

def hash_file_reference(file_reference):
    with open(file_reference.filename) as f:
      return f.read()

@st.cache(hash_funcs={FileReference: hash_file_reference})
def func(file_reference):
    ...
```

```eval_rst
.. note::
   Because Streamlit's hash function works recursively, you don't have to hash the contents inside `hash_file_reference` Instead, you can return a primitive type, in this case the contents of the file, and Streamlit's internal hasher will compute the actual hash from it.
```

### Typical hash functions

While it's possible to write custom hash functions, let's take a look at some of the tools that Python provides out of the box. Here's a list of some hash functions and when it makes sense to use them.

Python's [`id`](https://docs.python.org/3/library/functions.html#id) function | [Example](#example-1-pass-a-database-connection-around)

- Speed: Fast
- Use case: If you're hashing a singleton object, like an open database connection or a TensorFlow session. These are objects that will only be instantiated once, no matter how many times your script reruns.

`lambda _: None` | [Example](#example-2-turn-off-hashing-for-a-specific-type)

- Speed: Fast
- Use case: If you want to turn off hashing of this type. This is useful if you know the object is not going to change.

Python's [`hash()`](https://docs.python.org/3/library/functions.html#hash) function | [Example](#example-3-use-python-s-hash-function)

- Speed: Can be slow based the size of the object being cached
- Use case: If Python already knows how to hash this type correctly.

Custom hash function | [Example](#the-hash-funcs-parameter)

- Speed: N/a
- Use case: If you'd like to override how Streamlit hashes a particular type.

### Example 1: Pass a database connection around

Suppose we want to open a database connection that can be reused across multiple runs of a Streamlit app. For this you can make use of the fact that cached objects are stored by reference to automatically initialize and reuse the connection:

```Python
@st.cache(allow_output_mutation=True)
def get_database_connection():
    return db.get_connection()
```

With just 3 lines of code, the database connection is created once and stored in the cache. Then, every subsequent time `get_database_conection` is called, the already-created connection object is reused automatically. In other words, it becomes a singleton.

```eval_rst
.. tip::
   Use the `allow_output_mutation=True` flag to suppress the immutability check. This prevents Streamlit from trying to hash the output connection, and also turns off Streamlit's mutation warning in the process.
```

What if you want to write a function that receives a database connection as input? For that, you'll use `hash_funcs`:

```Python
@st.cache(hash_funcs={DBConnection: id})
def get_users(connection):
    # Note: We assume that connection is of type DBConnection.
    return connection.execute_sql('SELECT * from Users')
```

Here, we use Python's built-in `id` function, because the connection object is coming from the Streamlit cache via the `get_database_conection` function. This means that the same connection instance is passed around every time, and therefore it always has the same id. However, if you happened to have a second connection object around that pointed to an entirely different database, it would still be safe to pass it to `get_users` because its id is guaranteed to be different than the first id.

These design patterns apply any time you have an object that points to an external resource, such as a database connection or Tensorflow session.

### Example 2: Turn off hashing for a specific type

You can turn off hashing entirely for a particular type by giving it a custom hash function that returns a constant. One reason that you might do this is to avoid hashing large, slow-to-hash objects that you know are not going to change. For example:

```Python
@st.cache(hash_funcs={pd.DataFrame: lambda _: None})
def func(huge_constant_dataframe):
    ...
```

When Streamlit encounters an object of this type, it always converts the object into `None`, no matter which instance of `FooType` its looking at. This means all instances are hash to the same value, which effectively cancels out the hashing mechanism.

### Example 3: Use Python's `hash()` function

Sometimes, you might want to use Python’s default hashing instead of Streamlit's. For example, maybe you've encountered a type that Streamlit is unable to hash, but it's hashable with Python's built-in `hash()` function:

```Python
@st.cache(hash_funcs={FooType: hash})
def func(...):
    ...
```
