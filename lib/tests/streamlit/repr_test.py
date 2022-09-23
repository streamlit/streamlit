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

import streamlit.util as util


def test_repr_simple_class():
    class Foo:
        def __init__(self, foo, bar=5):
            self.foo = foo
            self.bar = bar

        def __repr__(self):
            return util.repr_(self)

    foo = Foo("words")
    assert repr(foo) == "Foo(foo='words', bar=5)"


def test_repr_dict_class():
    class Foo:
        def __repr__(self):
            return util.repr_(self)

    foo = Foo()
    foo.bar = "bar"
    assert repr(foo) == "Foo(bar='bar')"


def test_repr_thread_class():
    import threading

    thread = threading.current_thread()
    # This should return a non empty string and not raise an exception.
    assert str(thread) is not None
