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

"""st.help unit test."""

from __future__ import annotations

import inspect
import sys
import unittest
from unittest.mock import patch

import numpy as np
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.help import (
    _get_first_line,
    _get_signature,
    _get_variable_name_from_code_str,
    _is_computed_property,
)
from streamlit.errors import StreamlitInvalidWidthError
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


def patch_varname_getter():
    """Patches streamlit.elements.help so _get_variable_name() works outside ScriptRunner."""
    parent_frame_filename = inspect.getouterframes(inspect.currentframe())[2].filename

    return patch("streamlit.elements.help.SCRIPTRUNNER_FILENAME", parent_frame_filename)


class StHelpTest(DeltaGeneratorTestCase):
    """Test st.help."""

    def test_no_arg(self):
        """When st.help is called with no arguments, show Streamlit docs."""

        with patch_varname_getter():
            st.help()

        ds = self.get_delta_from_queue().new_element.help_info
        assert ds.name == ""
        assert ds.value == "streamlit"
        assert ds.type == "module"
        assert ds.doc_string.startswith("Streamlit.")

    def test_none_arg(self):
        """When st.help is called with None as an argument, don't show Streamlit docs."""

        with patch_varname_getter():
            st.help(None)

        ds = self.get_delta_from_queue().new_element.help_info
        assert ds.name == ""
        assert ds.value == "None"
        assert ds.type == "NoneType"

        if sys.version_info >= (3, 13):
            assert ds.doc_string == "The type of the None singleton."
        else:
            assert ds.doc_string == ""

    def test_basic_func_with_doc(self):
        """Test basic function with docstring."""

        def my_func(some_param, another_param=123):
            """This is the doc"""

        with patch_varname_getter():
            st.help(my_func)

        ds = self.get_delta_from_queue().new_element.help_info
        assert ds.name == "my_func"
        assert ds.value == (
            "tests.streamlit.elements.help_test.StHelpTest.test_basic_func_with_doc.<locals>.my_func(some_param, "
            "another_param=123)"
        )
        assert ds.type == "function"
        assert ds.doc_string == "This is the doc"

    def test_basic_func_without_doc(self):
        """Test basic function without docstring."""

        def my_func(some_param, another_param=123):
            pass

        with patch_varname_getter():
            st.help(my_func)

        ds = self.get_delta_from_queue().new_element.help_info
        assert ds.name == "my_func"
        assert ds.value == (
            "tests.streamlit.elements.help_test.StHelpTest.test_basic_func_without_doc.<locals>.my_func(some_param, "
            "another_param=123)"
        )
        assert ds.type == "function"
        assert ds.doc_string == ""

    def test_deltagenerator_func(self):
        """Test Streamlit DeltaGenerator function."""

        with patch_varname_getter():
            st.help(st.audio)

        ds = self.get_delta_from_queue().new_element.help_info
        assert ds.name == "st.audio"
        assert ds.type == "method"

        signature = (
            "(data: 'MediaData', format: 'str' = 'audio/wav', start_time: 'MediaTime' = 0, *, "
            "sample_rate: 'int | None' = None, end_time: 'MediaTime | None' = None, loop: 'bool' = False, "
            "autoplay: 'bool' = False, width: 'WidthWithoutContent' = 'stretch') -> 'DeltaGenerator'"
        )

        assert f"streamlit.delta_generator.MediaMixin.audio{signature}" == ds.value
        assert ds.doc_string.startswith("Display an audio player")

    def test_builtin_func(self):
        """Test a built-in function."""

        with patch_varname_getter():
            st.help(dir)

        ds = self.get_delta_from_queue().new_element.help_info
        assert ds.name == "dir"
        assert ds.value == "builtins.dir(...)"
        assert ds.type == "builtin_function_or_method"
        assert len(ds.doc_string) > 0

    def test_varname(self):
        """Test a named variable."""

        myvar = 123
        with patch_varname_getter():
            st.help(myvar)

        ds = self.get_delta_from_queue().new_element.help_info
        assert ds.name == "myvar"
        assert ds.value == "123"
        assert ds.type == "int"
        assert len(ds.doc_string) > 0

    def test_walrus(self):
        """Test a named variable using walrus operator."""

        with patch_varname_getter():
            st.help(myvar := 123)  # noqa: F841

        ds = self.get_delta_from_queue().new_element.help_info
        assert ds.name == "myvar"
        assert ds.value == "123"
        assert ds.type == "int"
        assert len(ds.doc_string) > 0

    def test_complex_var(self):
        """Test complex dict-list-object combination."""

        myvar = {"foo": [None, {"bar": "baz"}]}

        with patch_varname_getter():
            st.help(myvar["foo"][1]["bar"].strip)

        ds = self.get_delta_from_queue().new_element.help_info
        assert ds.name == 'myvar["foo"][1]["bar"].strip'
        assert ds.value == r"str.strip(chars=None, /)"
        assert ds.type == "builtin_function_or_method"
        assert len(ds.doc_string) > 0

    def test_builtin_obj(self):
        """Test a built-in function."""

        with patch_varname_getter():
            st.help(123)

        ds = self.get_delta_from_queue().new_element.help_info
        assert ds.name == ""
        assert ds.value == "123"
        assert ds.type == "int"
        assert len(ds.doc_string) > 0

    def test_doc_defined_for_type(self):
        """When the docs are defined for the type on an object, but not
        the object, we expect the docs of the type. This is the case
        of ndarray generated as follow.
        """

        array = np.arange(1)

        with patch_varname_getter():
            st.help(array)

        ds = self.get_delta_from_queue().new_element.help_info
        assert ds.name == "array"
        assert ds.value == "array([0])"
        assert ds.type == "ndarray"
        assert "ndarray" in ds.doc_string

    def test_passing_a_class(self):
        """When the object is a class and no docs are defined,
        we expect docs to be None."""

        class MyClass:
            pass

        with patch_varname_getter():
            st.help(MyClass)

        ds = self.get_delta_from_queue().new_element.help_info
        assert type(MyClass) is type
        assert ds.name == "MyClass"
        assert (
            ds.value
            == "tests.streamlit.elements.help_test.StHelpTest.test_passing_a_class.<locals>.MyClass()"
        )
        assert ds.type == "class"
        assert ds.doc_string == ""

    def test_passing_an_instance(self):
        """When the type of the object is type and no docs are defined,
        we expect docs to be None."""

        class MyClass:
            pass

        with patch_varname_getter():
            st.help(MyClass)

        ds = self.get_delta_from_queue().new_element.help_info
        assert type(MyClass) is type
        assert ds.name == "MyClass"
        assert (
            ds.value
            == "tests.streamlit.elements.help_test.StHelpTest.test_passing_an_instance.<locals>.MyClass()"
        )
        assert ds.type == "class"
        assert ds.doc_string == ""

    def test_class_members(self):
        class MyClass:
            a = 1
            b = 2

            def __init__(self):
                self.c = 3
                self.d = 4

            @property
            def e(self):
                "Property e"
                return 5

            @staticmethod
            def staticmethod1(x=10):
                "Static method 1"

            @classmethod
            def classmethod1(cls, y=20):
                "Class method 1"

        with patch_varname_getter():
            st.help(MyClass)

        ds = self.get_delta_from_queue().new_element.help_info
        assert len(ds.members) == 5

        expected_outputs = [
            ("a", "1", "", "int"),
            ("b", "2", "", "int"),
            ("e", "", "Property e", "property"),
            ("classmethod1", "", "Class method 1", "method"),
            ("staticmethod1", "", "Static method 1", "function"),
        ]

        for i, expected in enumerate(expected_outputs):
            assert ds.members[i].name == expected[0]
            assert ds.members[i].value == expected[1]
            assert ds.members[i].doc_string == expected[2]
            assert ds.members[i].type == expected[3]

    def test_instance_members(self):
        class MyClass:
            a = 1
            b = 2

            def __init__(self):
                self.c = 3
                self.d = 4

            @property
            def e(self):
                "Property e"
                return 5

            @staticmethod
            def staticmethod1(x=10):
                "Static method 1"

            @classmethod
            def classmethod1(cls, y=20):
                "Class method 1"

        my_instance = MyClass()

        with patch_varname_getter():
            st.help(my_instance)

        ds = self.get_delta_from_queue().new_element.help_info
        assert len(ds.members) == 7

        expected_outputs = [
            ("a", "1", "", "int"),
            ("b", "2", "", "int"),
            ("c", "3", "", "int"),
            ("d", "4", "", "int"),
            ("e", "", "Property e", "property"),
            ("classmethod1", "", "Class method 1", "method"),
            ("staticmethod1", "", "Static method 1", "function"),
        ]

        for i, expected in enumerate(expected_outputs):
            assert ds.members[i].name == expected[0]
            assert ds.members[i].value == expected[1]
            assert ds.members[i].doc_string == expected[2]
            assert ds.members[i].type == expected[3]


st_calls = [
    "st.help({0})",
    "st.write({0})",
]


class GetVariableNameFromCodeStrTest(unittest.TestCase):
    def test_st_help_no_arg(self):
        actual = _get_variable_name_from_code_str("st.help()")
        assert actual is None

    def test_variable_should_match_own_name(self):
        tests = [
            "a",
            "a_b",
            "a.b",
            "a[b]",
            "a[0]",
            "a[0].c",
            "a[0].c.foo()",
        ]

        for test in tests:
            for st_call in st_calls:
                # Wrap test in an st call.
                code = st_call.format(test)

                actual = _get_variable_name_from_code_str(code)
                assert actual == test

    def test_constant_should_have_no_name(self):
        tests = [
            "None",
            "0",
            "1",
            "123",
            "False",
            "True",
            "'some string'",
            "b'some bytes'",
            "...",
        ]

        for test in tests:
            for st_call in st_calls:
                # Wrap test in an st call.
                code = st_call.format(test)

                actual = _get_variable_name_from_code_str(code)
                assert actual is None

    def test_walrus_should_return_var_name(self):
        for st_call in st_calls:
            # Wrap test in an st call.
            code = st_call.format("a := 123")

            actual = _get_variable_name_from_code_str(code)
            assert actual == "a"

    def test_magic_should_just_echo(self):
        tests = [
            "a",
            "a_b",
            "a.b",
            "a[b]",
            "a[0]",
            "a[0].c",
            "a[0].c.foo()",
            "None",
            "0",
            "1",
            "123",
            "False",
            "True",
            "'some string'",
            "b'some bytes'",
            "...",
            "f'some {f} string'",
            "[x for x in range(10)]",
            "(x for x in range(10))",
            "{x: None for x in range(10)}",
        ]

        for code in tests:
            actual = _get_variable_name_from_code_str(code)
            assert actual == code

        # Testing with comma at the end
        tests += [
            "foo()",
        ]

        for code in tests:
            actual = _get_variable_name_from_code_str(code + ",")
            assert actual == code

    def test_if_dont_know_just_echo(self):
        tests = [
            (
                "foo()",
                "foo()",
            ),
            (
                "[x for x in range(10)]",
                "[x for x in range(10)]",
            ),
            (
                "(x for x in range(10))",
                "(x for x in range(10))",
            ),
            (
                "x for x in range(10)",
                # Python >= 3.8 has its own bug here (because of course) where the
                # column offsets are off by one in different directions, leading to parentheses
                # appearing around the generator expression. This leads to syntactically correct
                # code, though, so not so bad!
                "(x for x in range(10))",
            ),
            (
                "{x: None for x in range(10)}",
                "{x: None for x in range(10)}",
            ),
        ]

        for test, expected in tests:
            for st_call in st_calls:
                # Wrap test in an st call.
                code = st_call.format(test)

                actual = _get_variable_name_from_code_str(code)
                assert actual == expected

    def test_multiline_gets_linearized(self):
        test = """foo(
            "bar"
        )"""

        for st_call in st_calls:
            # Wrap test in an st call.
            code = st_call.format(test)

            actual = _get_variable_name_from_code_str(code)
            assert actual == "foo("


class ConditionalHello:
    """Helper class for testing conditional attribute access."""

    def __init__(self, available, ExceptionType=AttributeError):
        self.available = available
        self.ExceptionType = ExceptionType

    def __getattribute__(self, name):
        if name == "say_hello" and not self.available:
            raise self.ExceptionType(f"{name} is not accessible when x is even")
        return object.__getattribute__(self, name)

    def say_hello(self):
        pass


class StHelpAPITest(DeltaGeneratorTestCase):
    """Test public Streamlit APIs."""

    def test_st_help_with_available_conditional_members(self):
        """Test st.help with conditional members available"""

        st.help(ConditionalHello(True))
        el = self.get_delta_from_queue().new_element.help_info
        assert el.type == "ConditionalHello"
        member_names = [member.name for member in el.members]
        assert "say_hello" in member_names

    def test_st_help_with_unavailable_conditional_members(self):
        """Test st.help with conditional members not available
        via AttributeError"""

        st.help(ConditionalHello(False))
        el = self.get_delta_from_queue().new_element.help_info
        assert el.type == "ConditionalHello"
        member_names = [member.name for member in el.members]
        assert "say_hello" not in member_names

    def test_st_help_with_erroneous_members(self):
        """Test st.help with conditional members not available
        via some non-AttributeError exception"""

        with pytest.raises(
            ValueError, match="say_hello is not accessible when x is even"
        ):
            st.help(ConditionalHello(False, ValueError))

    def test_help_width(self):
        """Test that help() correctly handles width parameter."""

        st.help(st, width="stretch")
        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch

        st.help(st, width=500)
        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert c.width_config.pixel_width == 500

        st.help(st)
        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch

    @parameterized.expand(
        [
            ("string", "invalid"),
            ("negative", -100),
            ("zero", 0),
            ("float", 100.5),
            ("none", None),
        ]
    )
    def test_help_invalid_width(self, _name: str, width):
        """Test that help() raises an error for invalid width values."""
        with pytest.raises(StreamlitInvalidWidthError, match="Invalid width"):
            st.help(st, width=width)


def test_get_signature_returns_none_for_noncallable_nonclass() -> None:
    """``_get_signature`` returns ``None`` for non-callable, non-class objects.

    The function's early guard ``if not inspect.isclass(obj) and not callable(obj)``
    filters out objects that cannot have a signature.
    """
    assert _get_signature(123) is None
    assert _get_signature("string") is None
    assert _get_signature([1, 2, 3]) is None


def test_get_signature_returns_none_when_inspect_signature_raises_typeerror() -> None:
    """``_get_signature`` returns ``None`` when ``inspect.signature`` raises ``TypeError``.

    This test exercises the ``except TypeError: return None`` branch by using a
    callable with a ``__signature__`` property that raises ``TypeError``.
    """

    class CallableWithBrokenSignature:
        """A callable whose ``__signature__`` property raises TypeError."""

        def __call__(self) -> None:
            pass

        @property
        def __signature__(self) -> None:
            raise TypeError("cannot get signature")

    obj = CallableWithBrokenSignature()
    assert _get_signature(obj) is None


def test_get_signature_strips_element_prefix_for_delta_generator_callables() -> None:
    """``_get_signature`` rewrites the leading ``(element, ...)`` prefix when the
    callable lives in ``streamlit.delta_generator``.
    """

    def fn(element, x, y):  # type: ignore[no-untyped-def]
        pass

    # Spoof ``__module__`` so the ``is_delta_gen`` branch in ``_get_signature``
    # is exercised. The raw signature is ``(element, x, y)``; the helper must
    # strip the ``element, `` prefix and return ``(x, y)``.
    fn.__module__ = "streamlit.delta_generator"

    assert _get_signature(fn) == "(x, y)"


def test_get_signature_for_bound_delta_generator_method_does_not_leak_self() -> None:
    """For bound DeltaGenerator methods, the ``self`` parameter is hidden by
    ``inspect.signature`` and the resulting signature does not leak it.
    """
    sig = _get_signature(st.audio)

    assert sig is not None
    assert not sig.startswith("(self,")


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        pytest.param("", "", id="empty"),
        pytest.param("hello\nworld", "hello", id="multi_line"),
        pytest.param("only one line", "only one line", id="single_line"),
    ],
)
def test_get_first_line(text: str, expected: str) -> None:
    """``_get_first_line`` returns the substring before the first newline."""
    assert _get_first_line(text) == expected


@pytest.mark.parametrize(
    "obj",
    [pytest.param(None, id="none"), pytest.param(object(), id="bare_object")],
)
def test_is_computed_property_returns_false_for_unknown_attr(obj: object) -> None:
    """``_is_computed_property`` returns ``False`` when ``attr_name`` is not on the class hierarchy."""
    assert _is_computed_property(obj, "definitely_missing") is False


@pytest.mark.skipif(
    sys.version_info < (3, 14),
    reason="PEP 649 deferred annotation evaluation is only in Python 3.14+",
)
def test_get_signature_handles_pep649_annotations() -> None:
    """Handles PEP 649 deferred annotations referencing undefined types.

    On Python 3.14+, inspect.signature() raises NameError for annotations
    referencing types imported under TYPE_CHECKING. Our fix catches NameError
    and returns '(...)' as a fallback signature.

    See: https://github.com/streamlit/streamlit/issues/14324
    """
    from tests.testutil import create_pep649_function

    def base_func(items: object) -> None:
        pass

    func = create_pep649_function(
        base_func, {"items": "UndefinedType", "return": "None"}
    )

    # Verify that inspect.signature() without STRING format raises NameError
    with pytest.raises(NameError, match="UndefinedType"):
        inspect.signature(func)

    # Our _get_signature should handle this gracefully by returning "(...)
    signature = _get_signature(func)
    assert signature == "(...)"
