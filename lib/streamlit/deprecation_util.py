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

import enum
import functools
from typing import Any, Callable, List, TypeVar, cast

import streamlit

TFunc = TypeVar("TFunc", bound=Callable[..., Any])
TObj = TypeVar("TObj", bound=object)


class PrereleaseAPIType(enum.Enum):
    BETA = "BETA"
    EXPERIMENTAL = "EXPERIMENTAL"


def _get_function_name_prefix(api_type: PrereleaseAPIType) -> str:
    if api_type is PrereleaseAPIType.BETA:
        return "beta_"
    if api_type is PrereleaseAPIType.EXPERIMENTAL:
        return "experimental_"
    raise RuntimeError(f"Unrecognized PrereleaseAPIType: {api_type}")


def _show_api_graduation_warning(
    name: str, api_type: PrereleaseAPIType, removal_date: str
) -> None:
    prefix = _get_function_name_prefix(api_type)
    streamlit.warning(
        f"Please replace `st.{prefix}{name}` with `st.{name}`.\n\n"
        f"`st.{prefix}{name}` will be removed after {removal_date}."
    )


def function_beta_warning(func: TFunc, removal_date: str) -> TFunc:
    """Wrapper for functions that are no longer in beta.

    Wrapped functions will run as normal, but then proceed to show an st.warning
    saying that the beta_ version will be removed in ~3 months.

    Parameters
    ----------
    func: callable
        The `st.` function that used to be in beta.

    removal_date: str
        A date like "2020-01-01", indicating the last day we'll guarantee
        support for the beta_ prefix.
    """

    @functools.wraps(func)
    def wrapped_func(*args, **kwargs):
        result = func(*args, **kwargs)
        _show_api_graduation_warning(
            func.__name__, PrereleaseAPIType.BETA, removal_date
        )
        return result

    # Update the wrapped func's name & docstring so st.help does the right thing
    wrapped_func.__name__ = "beta_" + func.__name__
    wrapped_func.__doc__ = func.__doc__
    return cast(TFunc, wrapped_func)


def object_beta_warning(obj: TObj, obj_name: str, removal_date: str) -> TObj:
    """Wrapper for objects that are no longer in beta.

    Wrapped objects will run as normal, but then proceed to show an st.warning
    saying that the beta_ version will be removed in ~3 months.

    Parameters
    ----------
    obj: Any
        The `st.` object that used to be in beta.

    obj_name: str
        The name of the object within __init__.py

    removal_date: str
        A date like "2020-01-01", indicating the last day we'll guarantee
        support for the beta_ prefix.
    """

    has_shown_beta_warning = False

    def show_wrapped_obj_warning():
        nonlocal has_shown_beta_warning
        if not has_shown_beta_warning:
            has_shown_beta_warning = True
            _show_api_graduation_warning(obj_name, PrereleaseAPIType.BETA, removal_date)

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

    return cast(TObj, Wrapper(obj))
