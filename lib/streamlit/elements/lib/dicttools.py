# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

"""Tools for working with dicts."""

from __future__ import annotations

from typing import Any, Mapping


def _unflatten_single_dict(flat_dict: dict[Any, Any]) -> dict[Any, Any]:
    """Convert a flat dict of key-value pairs to dict tree.

    Example
    -------

        _unflatten_single_dict({
          foo_bar_baz: 123,
          foo_bar_biz: 456,
          x_bonks: 'hi',
        })

        # Returns:
        # {
        #   foo: {
        #     bar: {
        #       baz: 123,
        #       biz: 456,
        #     },
        #   },
        #   x: {
        #     bonks: 'hi'
        #   }
        # }

    Parameters
    ----------
    flat_dict : dict
        A one-level dict where keys are fully-qualified paths separated by
        underscores.

    Returns
    -------
    dict
        A tree made of dicts inside of dicts.

    """
    out: dict[str, Any] = {}
    for pathstr, v in flat_dict.items():
        path = pathstr.split("_")

        prev_dict: dict[str, Any] | None = None
        curr_dict = out

        for k in path:
            if k not in curr_dict:
                curr_dict[k] = {}
            prev_dict = curr_dict
            curr_dict = curr_dict[k]

        if prev_dict is not None:
            prev_dict[k] = v

    return out


def unflatten(
    flat_dict: dict[Any, Any], encodings: set[str] | None = None
) -> dict[Any, Any]:
    """Converts a flat dict of key-value pairs to a spec tree.

    Example
    -------
        unflatten({
          foo_bar_baz: 123,
          foo_bar_biz: 456,
          x_bonks: 'hi',
        }, ['x'])

        # Returns:
        # {
        #   foo: {
        #     bar: {
        #       baz: 123,
        #       biz: 456,
        #     },
        #   },
        #   encoding: {  # This gets added automatically
        #     x: {
        #       bonks: 'hi'
        #     }
        #   }
        # }

    Args
    ----
    flat_dict: dict
        A flat dict where keys are fully-qualified paths separated by
        underscores.

    encodings: set
        Key names that should be automatically moved into the 'encoding' key.

    Returns
    -------
    A tree made of dicts inside of dicts.
    """
    if encodings is None:
        encodings = set()

    out_dict = _unflatten_single_dict(flat_dict)

    for k, v in list(out_dict.items()):
        # Unflatten child dicts:
        if isinstance(v, dict):
            v = unflatten(v, encodings)
        elif hasattr(v, "__iter__"):
            for i, child in enumerate(v):
                if isinstance(child, dict):
                    v[i] = unflatten(child, encodings)

        # Move items into 'encoding' if needed:
        if k in encodings:
            if "encoding" not in out_dict:
                out_dict["encoding"] = {}
            out_dict["encoding"][k] = v
            out_dict.pop(k)

    return out_dict


def remove_none_values(input_dict: Mapping[Any, Any]) -> dict[Any, Any]:
    """Remove all keys with None values from a dict."""
    new_dict = {}
    for key, val in input_dict.items():
        if isinstance(val, dict):
            val = remove_none_values(val)
        if val is not None:
            new_dict[key] = val
    return new_dict
