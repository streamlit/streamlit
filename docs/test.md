# Tests

## Summary

As I'm moving around files and bulding up functionality in Armando's `2.7` branch, I'm compiling here a list of tests which I'm running which we can eventually compile into a test suite.

*- Adrien*

## Tests

- If you have a file called `test.py`, `urllib.py`, or `dbm.py` in your cwd, then streamlit will fail when calling `setup_2_3_shims()`.
- when you call `st.write()` on a string in both python 2 and 3, it treats it like a string (i.e. does not call markdown escape).
- the following code should include a traceback
```python
try:
    raise Exception('e1')
except Exception as e1:
    try:
        raise Exception('e2')
    except Exception as e2:
        st.exception(e2)
```
- in python2 (_only!_) the following code should **not** include a traceback
```python
try:
    raise Exception('e1')
except Exception as e1:
    try:
        raise Exception('e2')
    except Exception as e2:
        st.exception(e1)
```
- The following code causes an exception to be sent over the websocket connection.
```python
import streamlit
raise Exception('test')
```
- throwing an exception in a websocket handler decorated with `stop_proxy_on_exception()` causes the websocket to close
