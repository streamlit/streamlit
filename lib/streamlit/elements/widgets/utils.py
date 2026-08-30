# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import ast
import functools
import inspect
from typing import Callable, TypeVar

T = TypeVar("T")


def get_assign_target_name(func: Callable[..., T]) -> Callable[..., T]:
    """
    A decorator that captures the variable name a function result is assigned to.

    This decorator inspects the call frame to extract the variable name from an
    assignment statement. It then passes this name to the decorated function as
    a keyword argument "key" if the keyword argument is not already provided.

    Parameters
    ----------
    func : Callable
        The function to decorate.

    Returns
    -------
    Callable
        A decorated function that receives the assignment variable name as
        a "key" parameter if not already specified.

    Examples
    --------
    >>> @get_assign_target_name
    ... def my_widget(label, key=None):
    ...     # key will be "my_var" if not explicitly provided
    ...     print(f"Widget with label={label}, key={key}")
    >>> my_var = my_widget("Hello")  # key will be "my_var"
    Widget with label=Hello, key=my_var

    >>> my_widget("Hello", key="custom_key")  # explicitly provided key takes precedence
    Widget with label=Hello, key=custom_key

    >>> result = my_widget("Hello")  # key will be "result"
    Widget with label=Hello, key=result
    """

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        # If key is already provided, use it
        if "key" in kwargs:
            return func(*args, **kwargs)

        # Get the calling frame (one level up from current frame)
        frame = inspect.currentframe().f_back

        # Try to find the target variable name from the calling code
        if frame:
            try:
                # Get the context (source code) around the calling line
                context = inspect.getframeinfo(frame).code_context
                if context:
                    # The calling line should be the first line in context
                    line = context[0].strip()

                    # Parse the line to extract the variable name from an assignment
                    tree = ast.parse(line)
                    for node in ast.walk(tree):
                        # Look for assignments
                        if isinstance(node, ast.Assign):
                            # For simple assignments like: var_name = func()
                            if isinstance(node.targets[0], ast.Name):
                                var_name = node.targets[0].id
                                kwargs["key"] = var_name
                                break
                            # For tuple unpacking like: var_name, _ = func()
                            elif isinstance(node.targets[0], ast.Tuple):
                                # Just use the first variable name
                                var_name = node.targets[0].elts[0].id
                                kwargs["key"] = var_name
                                break
            except Exception:
                # If anything goes wrong with parsing, just proceed without setting the key
                pass

        return func(*args, **kwargs)

    return wrapper
