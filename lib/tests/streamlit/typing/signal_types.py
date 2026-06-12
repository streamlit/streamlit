# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from __future__ import annotations

from typing import TYPE_CHECKING

from typing_extensions import assert_type

# Perform some "type checking testing"; mypy should flag any assignments that are
# incorrect.
if TYPE_CHECKING:
    from streamlit.runtime.fragment import fragment
    from streamlit.runtime.signal import Signal, signal
    from streamlit.runtime.state.common import WidgetCallback

    # =====================================================================
    # st.signal type inference from a value initial
    # =====================================================================

    int_signal = signal(0, key="int_signal")
    assert_type(int_signal, Signal[int])
    assert_type(int_signal.value, int)
    assert_type(int_signal.send(1), None)
    assert_type(int_signal.key, str)

    str_signal = signal("US", key="str_signal")
    assert_type(str_signal, Signal[str])
    assert_type(str_signal.value, str)

    list_signal = signal([1, 2, 3], key="list_signal")
    assert_type(list_signal, Signal[list[int]])
    assert_type(list_signal.value, list[int])

    none_signal = signal(None, key="none_signal")
    assert_type(none_signal, Signal[None])

    # =====================================================================
    # st.signal type inference from a callable initial (lazy)
    # =====================================================================

    def make_list() -> list[str]:
        return []

    lazy_signal = signal(make_list, key="lazy_signal")
    assert_type(lazy_signal, Signal[list[str]])
    assert_type(lazy_signal.value, list[str])

    lambda_signal = signal(lambda: 1.5, key="lambda_signal")
    assert_type(lambda_signal, Signal[float])

    # Typed payload objects flow through end-to-end.
    class Filters:
        country: str = "US"

    # A class with a zero-arg constructor acts as a lazy initializer and
    # binds to the instance type.
    filters_class_signal = signal(Filters, key="filters_class_signal")
    assert_type(filters_class_signal, Signal[Filters])

    filters_signal = signal(Filters(), key="filters_signal")
    assert_type(filters_signal, Signal[Filters])
    assert_type(filters_signal.value.country, str)

    # =====================================================================
    # send / __call__ typing
    # =====================================================================

    # send() rejects values that don't match the signal's type.
    int_signal.send("nope")  # type: ignore[arg-type]
    str_signal.send(123)  # type: ignore[arg-type]
    filters_signal.send("oops")  # type: ignore[arg-type]

    # __call__ works bare (state unchanged) and with a matching value, so a
    # Signal is a valid widget callback with or without args.
    assert_type(int_signal(), None)
    assert_type(int_signal(2), None)
    int_signal("nope")  # type: ignore[arg-type]

    # A Signal satisfies the widget-callback protocol.
    callback: WidgetCallback = int_signal

    # key is required and keyword-only.
    signal(0)  # type: ignore[call-overload]
    signal(0, "key")  # type: ignore[call-overload]

    # =====================================================================
    # fragment(watch=...) typing
    # =====================================================================

    def my_fragment() -> None: ...

    # watch accepts a single signal or a sequence of signals, in both the
    # direct and the decorator-factory form.
    fragment(my_fragment, watch=int_signal)
    fragment(my_fragment, watch=[int_signal, str_signal])
    fragment(my_fragment, watch=None)
    fragment(watch=int_signal)(my_fragment)

    fragment(my_fragment, watch="nope")  # type: ignore[arg-type]
