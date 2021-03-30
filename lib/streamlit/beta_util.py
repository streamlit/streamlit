# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import streamlit


def _show_beta_warning(name: str, date: str) -> None:
    streamlit.warning(
        f"`st.{name}` has graduated out of beta. "
        + f"On {date}, the beta_ version will be removed.\n\n"
        + f"Before then, update your code from `st.beta_{name}` to `st.{name}`."
    )


def function_beta_warning(func, date):
    """Wrapper for functions that are no longer in beta.

    Wrapped functions will run as normal, but then proceed to show an st.warning
    saying that the beta_ version will be removed in ~3 months.

    Parameters
    ----------
    func: function
        The `st.` function that used to be in beta.

    date: str
        A date like "2020-01-01", indicating the last day we'll guarantee
        support for the beta_ prefix.
    """

    def wrapped_func(*args, **kwargs):
        # Note: Since we use a wrapper, beta_ functions will not autocomplete
        # correctly on VSCode.
        result = func(*args, **kwargs)
        _show_beta_warning(func.__name__, date)
        return result

    # Update the wrapped func's name & docstring so st.help does the right thing
    wrapped_func.__name__ = "beta_" + func.__name__
    wrapped_func.__doc__ = func.__doc__
    return wrapped_func


def object_beta_warning(obj, obj_name, date):
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

    class Wrapper:
        def __init__(self, obj):
            self._obj = obj

        def __getattr__(self, attr):
            if attr in self.__dict__:
                return getattr(self, attr)

            if not attr.startswith("_"):
                _show_beta_warning(obj_name, date)

            return getattr(self._obj, attr)

    return Wrapper(obj)
