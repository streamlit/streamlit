# Advanced caching

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
   - Executes the cached function (i.e. output = `expensive_computation(2, 21)`).
   - Calculates the `output_hash` from the function's `output`.
   - Stores `key → (output, output_hash)` in the cache.
1. Returns the output.

If an error is encountered an exception is raised. If the error occurs while hashing either the key or the output an `UnhashableTypeError` error is thrown. If you run into any issues, see [fixing caching issues](troubleshooting/caching_issues.md).

## The `hash_funcs` parameter

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

## Typical hash functions

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

## Example 1: Pass a database connection around

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

## Example 2: Turn off hashing for a specific type

You can turn off hashing entirely for a particular type by giving it a custom hash function that returns a constant. One reason that you might do this is to avoid hashing large, slow-to-hash objects that you know are not going to change. For example:

```Python
@st.cache(hash_funcs={pd.DataFrame: lambda _: None})
def func(huge_constant_dataframe):
    ...
```

When Streamlit encounters an object of this type, it always converts the object into `None`, no matter which instance of `FooType` its looking at. This means all instances are hash to the same value, which effectively cancels out the hashing mechanism.

## Example 3: Use Python's `hash()` function

Sometimes, you might want to use Python’s default hashing instead of Streamlit's. For example, maybe you've encountered a type that Streamlit is unable to hash, but it's hashable with Python's built-in `hash()` function. In that case, the solution is quite simple:

```Python
@st.cache(hash_funcs={FooType: hash})
def func(...):
    ...
```

## Next steps

- [Advanced concepts](advanced_concepts.md)
