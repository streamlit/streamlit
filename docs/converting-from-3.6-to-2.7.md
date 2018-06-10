# Converting From Python 3.6 to 2.7.10

**Note:** The version of Python we're supporting now is `2.7.10`!

## Rules to Bear in Mind When Writing 2/3 Compatible Code

- Don't use `{}` to create a dict, use `dict()` which comes from `builtins.dict`
-

## Source to Edit

## Template for a 2/3 compatible Python File

```python
# -*- coding: future_fstrings -*-

"""Include module docstring here."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.future import setup_2_3_compatibility
setup_2_3_compatibility(globals())

# rest of the imports and module definition below
```

- lib/setup.py

## Source Documents

- [Cheat Sheet: Writing Python 2-3 compatible code](http://python-future.org/compatible_idioms.html)
