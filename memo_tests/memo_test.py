import functools
import inspect
from typing import List, Optional, Callable, Any

import streamlit as st


def foo(posOnly, /, pos0, pos1, *args, kw_only, **kwargs) -> str:
    return f"{posOnly}, {pos0}, {pos1}, {args}, {kw_only}, {kwargs}"


signature = inspect.signature(foo)
params: List[inspect.Parameter] = list(signature.parameters.values())
st.write(signature.parameters.values())


def _get_positional_arg_name(func: Callable[..., Any], index: int) -> Optional[str]:
    if index < 0:
        return None

    params: List[inspect.Parameter] = list(inspect.signature(func).parameters.values())
    if index >= len(params):
        return None

    if params[index].kind in (
        inspect.Parameter.POSITIONAL_OR_KEYWORD,
        inspect.Parameter.POSITIONAL_ONLY,
    ):
        return params[index].name

    return None


def wrapper(func):
    @functools.wraps(func)
    def wrapped_func(*args, **kwargs):
        arg_pairs = []
        for arg_idx in range(len(args)):
            arg_pairs.append(
                (_get_positional_arg_name(func, index=arg_idx), args[arg_idx])
            )
        for kw_name, kw_val in kwargs.items():
            arg_pairs.append((kw_name, kw_val))

        arg_names = ", ".join(str(ap) for ap in arg_pairs)
        st.write(f"{func.__name__} called with `{arg_names}`")

        return func(*args, **kwargs)

    return wrapped_func


result = wrapper(foo)(
    "posOnly",
    "pos0",
    "pos1",
    "*args0",
    "*args1",
    kw_only="kw_only",
    kwargs0="kwargs0",
    kwargs1="kwargs1",
)
st.write(result)
