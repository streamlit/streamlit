# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import functools
from typing import Any, Callable, List, TypeVar, cast

import streamlit

F = TypeVar("F", bound=Callable[..., Any])


def _show_beta_warning(name: str, date: str) -> None:
    streamlit.warning(
        f"Please replace `st.beta_{name}` with `st.{name}`.\n\n"
        f"`st.beta_{name}` will be removed after {date}."
    )


def function_beta_warning(func: F, date: str) -> F:
    """Wrapper for functions that are no longer in beta.

    Wrapped functions will run as normal, but then proceed to show an st.warning
    saying that the beta_ version will be removed in ~3 months.

    Parameters
    ----------
    func: callable
        The `st.` function that used to be in beta.

    date: str
        A date like "2020-01-01", indicating the last day we'll guarantee
        support for the beta_ prefix.
    """

    @functools.wraps(func)
    def wrapped_func(*args, **kwargs):
        result = func(*args, **kwargs)
        _show_beta_warning(func.__name__, date)
        return result

    # Update the wrapped func's name & docstring so st.help does the right thing
    wrapped_func.__name__ = "beta_" + func.__name__
    wrapped_func.__doc__ = func.__doc__
    return cast(F, wrapped_func)


def object_beta_warning(obj: object, obj_name: str, date: str) -> object:
    """Wrapper for objects that are no longer in beta.

    Wrapped objects will run as normal, but then proceed to show an st.warning
    saying that the beta_ version will be removed in ~3 months.

    Parameters
    ----------
    obj: Any
        The `st.` object that used to be in beta.

    obj_name: str
        The name of the object within __init__.py

    date: str
        A date like "2020-01-01", indicating the last day we'll guarantee
        support for the beta_ prefix.
    """

    has_shown_beta_warning = False

    def show_wrapped_obj_warning():
        nonlocal has_shown_beta_warning
        if not has_shown_beta_warning:
            has_shown_beta_warning = True
            _show_beta_warning(obj_name, date)

    class Wrapper:
        def __init__(self, obj):
            self._obj = obj

            # Override all the Wrapped object's magic functions
            for name in Wrapper._get_magic_functions(obj.__class__):
                setattr(
                    self.__class__,
                    name,
                    property(self._make_magic_function_proxy(name)),
                )

        def __getattr__(self, attr):
            # We handle __getattr__ separately from our other magic
            # functions. The wrapped class may not actually implement it,
            # but we still need to implement it to call all its normal
            # functions.
            if attr in self.__dict__:
                return getattr(self, attr)

            show_wrapped_obj_warning()
            return getattr(self._obj, attr)

        @staticmethod
        def _get_magic_functions(cls) -> List[str]:
            # ignore the handful of magic functions we cannot override without
            # breaking the Wrapper.
            ignore = ("__class__", "__dict__", "__getattribute__", "__getattr__")
            return [
                name
                for name in dir(cls)
                if name not in ignore and name.startswith("__")
            ]

        @staticmethod
        def _make_magic_function_proxy(name):
            def proxy(self, *args):
                show_wrapped_obj_warning()
                return getattr(self._obj, name)

            return proxy

    return Wrapper(obj)
