# Caching issues

While developing an app, if you see an error or warning that stems from a cached function, it's probably related to the hashing procedure described in the [Advanced caching](../advanced_caching.md). In this article, we'll provide solutions to common issues encountered when using caching. If you have an issue that's not covered in this article, please let us know in the [community forum](https://discuss.streamlit.io/).

## How to debug a cached function that isn't executing

If you believe your cached function isn't executing even though its inputs are a "Cache miss", a simple way to debug is to add [`st.write`](../api.html#streamlit.write) statements inside and outside of your function like this:

```Python
@st.cache
def my_cached_func(a, b):
    st.write("Cache miss: my_cached_func(", a, ", ", b, ") ran")
    ...

st.write("Calling my_cached_func(", a, ", ", b, ")")
my_cached_func(2, 21)
```

## How to fix an `UnhashableTypeError`

Streamlit raises this error whenever it encounters a type it doesn't know how to hash. This could be either when hashing the inputs to generate the cache key or when hashing the output to verify whether it changed. To address it, you'll need to help Streamlit understand how to hash that type by using the `hash_funcs` argument:

```Python
@st.cache(hash_funcs={FooType: hash_foo_type})
def my_cached_func(a, b):
    ...
```

Here, `FooType` is the type Streamlit was unable to hash, and `hash_foo_type` is a function that can be used to properly hash `FooType` objects.

For example, if you'd like to make Streamlit ignore a specific type of object when hashing, you can pass a constant function to `hash_funcs`, like this:

```Python
@st.cache(hash_funcs={FooType: lambda _: None})
def my_cached_func(a, b):
    ...
```

For more information, see [Advanced caching](../advanced_caching.html#the-hash-funcs-parameter).

## How to fix the Cached Object Mutated warning

By default Streamlit expects its cached values to be treated as immutable -- that cached objects remain constant. You received this warning if your code modified a cached object (see [Example 5 in Caching](../caching.html#example-5-use-the-global-cache-to-speed-up-your-app-for-all-users)). When this happens, you have a few options:

1. If you don't understand why you're seeing this error, it's very likely that you didn't mean to mutate the cached value in the first place. So you should either:

- **Preferred:** rewrite your code to remove that mutation
- Clone the output of the cached function before mutating it. For example:
  ```Python
  import copy
  cloned_output = copy.deepcopy(my_cached_function(...))
  ```

2. If you wanted to allow the cached object to mutate, you can disable this check by setting `allow_output_mutation=True` like this:

   ```Python
   @st.cache(allow_output_mutation=True)
   def my_cached_func(...):
      ...
   ```

   For examples, see [Advanced caching](../advanced_caching.md).

   ```eval_rst
   .. note::
      If your function returns multiple objects and you only want to allow a subset of them to mutate between runs, you can do that with the `hash_funcs` option.
   ```

3. If Streamlit is incorrectly hashing the cached object, you can override this by using `hash_funcs`. For example, if your function returns an object of type `FooType` then you could write:

   ```Python
   @st.cache(hash_funcs={FooType: hash_func_for_foo_type})
   def my_cached_func(...):
      ...
   ```

   For more information, see [Advanced caching](../advanced_caching.html#the-hash-funcs-parameter).

   By the way, the scenario above is fairly unlikely — unless `FooType` does something particularly tricky internally. This is the case with some `SpaCY` objects, which can automatically mutate behind the scenes for better performance, while keeping their semantics constant. That means Streamlit will correctly detect a mutation in the object's internal structure, even though semantically that mutation makes no difference.

## If all else fails

If the proposed fixes above don't work for you, or if you have an idea on how to further improve [`@st.cache`](../api.html#streamlit.cache) -- let us know by asking questions in the [community forum](https://discuss.streamlit.io/), [filing a bug](https://github.com/streamlit/streamlit/issues/new/choose), or [submitting a feature request](https://github.com/streamlit/streamlit/issues/new/choose). We love hearing back from the community!
