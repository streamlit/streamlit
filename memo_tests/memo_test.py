import functools
import inspect
from typing import List, Optional, Callable, Any

import streamlit as st


def foo(a: int, b: int, *args, kw_only, **kwargs) -> str:
    return f"{a}, {b}, {args}, {kw_only}, {kwargs}"


signature = inspect.signature(foo)
params: List[inspect.Parameter] = list(signature.parameters.values())
st.write(signature.parameters.values())


def _get_arg_name(func: Callable[..., Any], index: int) -> Optional[str]:
    if index < 0:
        return None

    params: List[inspect.Parameter] = list(inspect.signature(func).parameters.values())
    if index >= len(params):
        return None

    if params[index].kind == inspect.Parameter.POSITIONAL_OR_KEYWORD:
        return params[index].name

    return None


def wrapper(func):
    @functools.wraps(func)
    def wrapped_func(*args, **kwargs):
        arg_pairs = []
        for arg_idx in range(len(args)):
            arg_pairs.append((_get_arg_name(func, index=arg_idx), args[arg_idx]))
        for kw_name, kw_val in kwargs.items():
            arg_pairs.append((kw_name, kw_val))

        arg_names = ", ".join(str(ap) for ap in arg_pairs)
        st.write(f"{func.__name__} called with {arg_names}")

        return func(*args, **kwargs)

    return wrapped_func


result = wrapper(foo)(1, 2, 3, 4, kw_only=True, qwert=False)
st.write(result)
