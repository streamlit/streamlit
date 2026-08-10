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

"""text_input unit test."""

import re
from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.lib.utils import compute_and_register_element_id
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitInvalidBindValueError,
    StreamlitInvalidWidthError,
    StreamlitValueError,
)
from streamlit.proto.LabelVisibility_pb2 import LabelVisibility
from streamlit.proto.TextInput_pb2 import TextInput
from streamlit.testing.v1.app_test import AppTest
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class TextInputTest(DeltaGeneratorTestCase):
    """Test ability to marshall text_input protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.text_input("the label")

        c = self.get_delta_from_queue().new_element.text_input
        assert c.label == "the label"
        assert (
            c.label_visibility.value == LabelVisibility.LabelVisibilityOptions.VISIBLE
        )
        assert c.default == ""
        assert c.HasField("default")
        assert c.type == TextInput.DEFAULT
        assert not c.disabled

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.text_input("the label", disabled=True)

        c = self.get_delta_from_queue().new_element.text_input
        assert c.disabled

    def test_value_types(self):
        """Test that it supports different types of values."""
        arg_values = ["some str", 123, {}, SomeObj()]
        proto_values = ["some str", "123", "{}", ".*SomeObj.*"]

        for arg_value, proto_value in zip(arg_values, proto_values, strict=False):
            st.text_input("the label", arg_value)

            c = self.get_delta_from_queue().new_element.text_input
            assert c.label == "the label"
            assert re.match(proto_value, c.default)

    def test_none_value(self):
        """Test that it can be called with None as initial value."""
        st.text_input("the label", value=None)

        c = self.get_delta_from_queue().new_element.text_input
        assert c.label == "the label"
        # If a proto property is null, it is not determined by
        # this value, but by the check via the HasField method:
        assert c.default == ""
        assert not c.HasField("default")

    def test_input_types(self):
        # Test valid input types.
        type_strings = ["default", "password", "email", "url", "phone", "search"]
        type_values = [
            TextInput.DEFAULT,
            TextInput.PASSWORD,
            TextInput.EMAIL,
            TextInput.URL,
            TextInput.PHONE,
            TextInput.SEARCH,
        ]
        for type_string, type_value in zip(type_strings, type_values, strict=True):
            st.text_input("label", type=type_string)

            c = self.get_delta_from_queue().new_element.text_input
            assert type_value == c.type

        # An invalid input type should raise an exception.
        with pytest.raises(StreamlitValueError) as exc:
            st.text_input("label", type="bad_type")

        assert (
            str(exc.value)
            == "Invalid `type` value. Supported values: 'default', 'password', "
            "'email', 'url', 'phone', 'search'."
        )

    @parameterized.expand(
        [
            ("email", ":material/mail:", "you@example.com", "email"),
            ("url", ":material/link:", "https://example.com", "url"),
            ("phone", ":material/call:", "+1 234 567 8900", "tel"),
            ("search", ":material/search:", "Search", "off"),
        ]
    )
    def test_specialized_type_smart_defaults(
        self,
        type_string: str,
        expected_icon: str,
        expected_placeholder: str,
        expected_autocomplete: str,
    ):
        """Test that specialized types apply their icon/placeholder/autocomplete defaults."""
        st.text_input("label", type=type_string)

        c = self.get_delta_from_queue().new_element.text_input
        assert c.icon == expected_icon
        assert c.placeholder == expected_placeholder
        assert c.autocomplete == expected_autocomplete

    @parameterized.expand(
        [
            (
                "email",
                r"^[^\s@]+@[^\s@]+\.[^\s@]+$",
                "Enter a valid email address.",
            ),
            (
                "url",
                r"^([Hh][Tt][Tt][Pp][Ss]?://)?[^\s/.]+\.[^\s]+$",
                "Enter a valid URL.",
            ),
        ]
    )
    def test_specialized_type_default_validation(
        self, type_string: str, expected_regex: str, expected_message: str
    ):
        """Test that email/url types default to Streamlit-maintained validation."""
        st.text_input("label", type=type_string)

        c = self.get_delta_from_queue().new_element.text_input
        assert c.validate_regex == expected_regex
        assert c.validate_message == expected_message

    @parameterized.expand(
        [
            # Requires a dotted domain: `user@host.tld` passes, `user@host` fails.
            ("user@host.tld", True),
            ("a@b.co", True),
            ("user@host", False),
            ("a@b", False),
            ("not-an-email", False),
        ]
    )
    def test_email_type_default_validation_requires_dotted_domain(
        self, value: str, should_match: bool
    ):
        """Test that the default email validation requires a dotted domain."""
        st.text_input("label", type="email")
        proto = self.get_delta_from_queue().new_element.text_input

        matched = re.match(proto.validate_regex, value) is not None
        assert matched is should_match

    @parameterized.expand(
        [
            # (value, should_match) — the URL scheme is optional.
            ("example.com", True),
            ("www.example.co.uk/path?q=1", True),
            ("https://example.com", True),
            ("http://sub.example.com", True),
            # The scheme is case-insensitive, matching native `type="url"`.
            ("HTTPS://example.com", True),
            ("not a url", False),
            ("localhost", False),
            # The first host label excludes `/`, so a bare filesystem-like path
            # and malformed schemes are rejected even though a path after the
            # host (see `www.example.co.uk/path?q=1` above) is accepted.
            ("path/to/file.txt", False),
            ("https://.example.com", False),
            ("https:/example.com", False),
        ]
    )
    def test_url_type_default_validation_scheme_is_optional(
        self, value: str, should_match: bool
    ):
        """Test that the default URL validation accepts URLs with or without a
        scheme while still rejecting obvious non-URLs."""
        st.text_input("label", type="url")
        proto = self.get_delta_from_queue().new_element.text_input

        matched = re.match(proto.validate_regex, value) is not None
        assert matched is should_match

    @parameterized.expand([("phone",), ("search",)])
    def test_specialized_type_without_default_validation(self, type_string: str):
        """Test that phone/search types don't apply any default validation."""
        st.text_input("label", type=type_string)

        c = self.get_delta_from_queue().new_element.text_input
        assert not c.HasField("validate_regex")
        assert not c.HasField("validate_message")

    def test_password_type_has_no_smart_defaults(self):
        """Test that type='password' is unchanged: no icon/placeholder/validation."""
        st.text_input("label", type="password")

        c = self.get_delta_from_queue().new_element.text_input
        assert c.icon == ""
        assert c.placeholder == ""
        assert not c.HasField("validate_regex")
        assert c.autocomplete == "new-password"

    def test_specialized_type_icon_opt_out(self):
        """Test that icon='' turns the icon off (and does not raise) for a type default."""
        st.text_input("label", type="email", icon="")

        c = self.get_delta_from_queue().new_element.text_input
        assert c.icon == ""

    def test_specialized_type_placeholder_opt_out(self):
        """Test that placeholder='' turns the placeholder off for a specialized type."""
        st.text_input("label", type="email", placeholder="")

        c = self.get_delta_from_queue().new_element.text_input
        assert c.placeholder == ""

    def test_specialized_type_validate_opt_out(self):
        """Test that validate='' turns the default validation off for a specialized type."""
        st.text_input("label", type="email", validate="")

        c = self.get_delta_from_queue().new_element.text_input
        assert c.validate_regex == ""
        assert not c.HasField("validate_message")

    def test_specialized_type_autocomplete_opt_out(self):
        """Test that autocomplete='' turns autocomplete off for a specialized type."""
        st.text_input("label", type="email", autocomplete="")

        c = self.get_delta_from_queue().new_element.text_input
        assert c.autocomplete == ""

    def test_specialized_type_explicit_overrides_win(self):
        """Test that explicit values override the type-derived defaults."""
        st.text_input(
            "label",
            type="email",
            icon=":material/work:",
            placeholder="name@company.com",
            validate=("^a$", "custom message"),
            autocomplete="on",
        )

        c = self.get_delta_from_queue().new_element.text_input
        assert c.icon == ":material/work:"
        assert c.placeholder == "name@company.com"
        assert c.validate_regex == "^a$"
        assert c.validate_message == "custom message"
        assert c.autocomplete == "on"

    def test_validate_none_semantics_depends_on_type(self):
        """Test that validate=None uses the email default but stays off for default."""
        st.text_input("email", type="email", validate=None)
        email_proto = self.get_delta_from_queue().new_element.text_input
        assert email_proto.validate_regex == r"^[^\s@]+@[^\s@]+\.[^\s@]+$"

        st.text_input("default", type="default", validate=None)
        default_proto = self.get_delta_from_queue().new_element.text_input
        assert not default_proto.HasField("validate_regex")

    def test_specialized_type_identity_stable_with_defaults(self):
        """Test that type-derived defaults do not enter the email widget identity.

        The live ID must match an expected ID computed from the raw user kwargs
        (``None`` enhanced params, no ``validate`` identity kwarg). Folding the
        email defaults into the hash would change that expected ID. Opting out
        with ``validate=""`` must stay identity-neutral with the default rule.
        """
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            st.text_input("label", key="email_key", type="email")
            actual_id = self.get_delta_from_queue().new_element.text_input.id

            # Reproduce identity from raw kwargs before type-default resolution.
            # For a keyed widget, dg-derived keys are dropped, so `dg=None`
            # yields the same result as passing the real dg.
            expected_id = compute_and_register_element_id(
                "text_input",
                user_key="email_key",
                key_as_main_identity={"max_chars", "validate"},
                dg=None,
                label="label",
                value="",
                max_chars=None,
                type="email",
                help=None,
                autocomplete=None,
                placeholder=str(None),
                icon=None,
                width="stretch",
            )
            assert actual_id == expected_id

            # Default email validation and an explicit opt-out share an ID —
            # the type's default rule must stay identity-neutral.
            st.text_input("label", key="email_key", type="email", validate="")
            opt_out_id = self.get_delta_from_queue().new_element.text_input.id
            assert actual_id == opt_out_id

    @parameterized.expand([("email",), ("url",), ("phone",), ("search",)])
    def test_bind_query_params_allowed_for_specialized_types(self, type_string: str):
        """Test that bind='query-params' is allowed for non-password specialized types."""
        st.text_input("label", key="my_text", bind="query-params", type=type_string)

        c = self.get_delta_from_queue().new_element.text_input
        assert c.query_param_key == "my_text"

    def test_placeholder(self):
        """Test that it can be called with placeholder"""
        st.text_input("the label", "", placeholder="testing")

        c = self.get_delta_from_queue().new_element.text_input
        assert c.label == "the label"
        assert c.default == ""
        assert c.placeholder == "testing"
        assert c.type == TextInput.DEFAULT

    def test_validate_none(self):
        """Test that validate=None does not set validation proto fields."""
        st.text_input("the label", validate=None)

        c = self.get_delta_from_queue().new_element.text_input
        assert not c.HasField("validate_regex")
        assert not c.HasField("validate_message")

    def test_validate_regex_string(self):
        """Test that a regex string is marshalled to validate_regex."""
        st.text_input("the label", validate="^[a-z]+$")

        c = self.get_delta_from_queue().new_element.text_input
        assert c.validate_regex == "^[a-z]+$"
        assert c.HasField("validate_regex")
        assert not c.HasField("validate_message")

    def test_validate_regex_tuple(self):
        """Test that a regex tuple is marshalled to validate fields."""
        st.text_input("the label", validate=("^[a-z]+$", "Lowercase only"))

        c = self.get_delta_from_queue().new_element.text_input
        assert c.validate_regex == "^[a-z]+$"
        assert c.validate_message == "Lowercase only"
        assert c.HasField("validate_regex")
        assert c.HasField("validate_message")

    def test_validate_empty_string(self):
        """Test that validate="" marshals an empty regex (a no-op on the frontend).

        An empty regex string carries no constraint: the frontend treats a
        falsy ``validate_regex`` as "no validation configured", so an empty
        string disables validation rather than matching everything.
        """
        st.text_input("the label", validate="")

        c = self.get_delta_from_queue().new_element.text_input
        assert c.validate_regex == ""
        assert not c.HasField("validate_message")

    @parameterized.expand(
        [
            ("wrong_tuple_length", ("only-one",)),
            ("non_string_regex", (1, "msg")),
            ("non_string_message", ("rx", 1)),
            ("list_shape", ["rx", "msg"]),
            ("callable", lambda _value: True),
        ]
    )
    def test_invalid_validate_shapes_raise(self, _name, validate):
        """Test that invalid validate values raise StreamlitAPIException."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.text_input("the label", validate=validate)

        assert "validate" in str(exc.value)

    def test_outside_form(self):
        """Test that form id is marshalled correctly outside of a form."""

        st.text_input("foo")

        proto = self.get_delta_from_queue().new_element.text_input
        assert proto.form_id == ""

    def test_emoji_icon(self):
        """Test that it can be called with an emoji icon."""
        st.text_input("foo", icon="📋")

        c = self.get_delta_from_queue().new_element.text_input
        assert c.icon == "📋"

    def test_material_icon(self):
        """Test that it can be called with a material icon."""
        st.text_input("foo", icon=":material/search:")

        c = self.get_delta_from_queue().new_element.text_input
        assert c.icon == ":material/search:"

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form(self):
        """Test that form id is marshalled correctly inside of a form."""

        with st.form("form"):
            st.text_input("foo")

        # 2 elements will be created: form block, widget
        assert len(self.get_all_deltas_from_queue()) == 2

        form_proto = self.get_delta_from_queue(0).add_block
        text_input_proto = self.get_delta_from_queue(1).new_element.text_input
        assert text_input_proto.form_id == form_proto.form.form_id

    def test_inside_column(self):
        """Test that it works correctly inside of a column."""
        col1, _col2, _col3 = st.columns([2.5, 1.5, 0.5])

        with col1:
            st.text_input("foo")

        all_deltas = self.get_all_deltas_from_queue()

        # 5 elements will be created: 1 horizontal block, 3 columns, 1 widget
        assert len(all_deltas) == 5
        text_input_proto = self.get_delta_from_queue().new_element.text_input

        assert text_input_proto.label == "foo"

    def test_autocomplete_defaults(self):
        """If 'autocomplete' is unspecified, it defaults to the empty string
        for default inputs, and "new-password" for password inputs.
        """
        st.text_input("foo")
        proto = self.get_delta_from_queue().new_element.text_input
        assert proto.autocomplete == ""

        st.text_input("password", type="password")
        proto = self.get_delta_from_queue().new_element.text_input
        assert proto.autocomplete == "new-password"

    def test_autcomplete(self):
        """Autocomplete should be marshalled if specified."""
        st.text_input("foo", autocomplete="you-complete-me")
        proto = self.get_delta_from_queue().new_element.text_input
        assert proto.autocomplete == "you-complete-me"

    @parameterized.expand(
        [
            ("visible", LabelVisibility.LabelVisibilityOptions.VISIBLE),
            ("hidden", LabelVisibility.LabelVisibilityOptions.HIDDEN),
            ("collapsed", LabelVisibility.LabelVisibilityOptions.COLLAPSED),
        ]
    )
    def test_label_visibility(self, label_visibility_value, proto_value):
        """Test that it can be called with label_visibility param."""
        st.text_input("the label", label_visibility=label_visibility_value)
        c = self.get_delta_from_queue().new_element.text_input
        assert c.label_visibility.value == proto_value

    def test_label_visibility_wrong_value(self):
        with pytest.raises(StreamlitAPIException) as e:
            st.text_input("the label", label_visibility="wrong_value")
        assert (
            str(e.value)
            == "Unsupported label_visibility option 'wrong_value'. Valid values are 'visible', 'hidden' or 'collapsed'."
        )

    def test_width_config_default(self):
        """Test that default width is 'stretch'."""
        st.text_input("the label")

        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch

    def test_width_config_pixel(self):
        """Test that pixel width works properly."""
        st.text_input("the label", width=100)

        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.PIXEL_WIDTH.value
        )
        assert c.width_config.pixel_width == 100

    def test_width_config_stretch(self):
        """Test that 'stretch' width works properly."""
        st.text_input("the label", width="stretch")

        c = self.get_delta_from_queue().new_element
        assert (
            c.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_STRETCH.value
        )
        assert c.width_config.use_stretch

    @parameterized.expand(
        [
            "invalid",
            -100,
            0,
            100.5,
            None,
        ]
    )
    def test_invalid_width(self, width):
        """Test that invalid width values raise exceptions."""
        with pytest.raises(StreamlitInvalidWidthError):
            st.text_input("the label", width=width)

    def test_shows_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.text_input("the label"))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-3).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning

    def test_stable_id_with_key(self):
        """Test that the widget ID is stable when a stable key is provided."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            # First render with certain params
            st.text_input(
                label="Label 1",
                key="text_input_key",
                value="abc",
                help="Help 1",
                disabled=False,
                width="stretch",
                on_change=lambda: None,
                args=("arg1", "arg2"),
                kwargs={"kwarg1": "kwarg1"},
                label_visibility="visible",
                placeholder="placeholder 1",
                max_chars=50,
                type="default",
                autocomplete="auto1",
                icon=":material/search:",
            )
            c1 = self.get_delta_from_queue().new_element.text_input
            id1 = c1.id

            # Second render with different params but same key (keep max_chars the same)
            st.text_input(
                label="Label 2",
                key="text_input_key",
                value="def",
                help="Help 2",
                disabled=True,
                width=200,
                on_change=lambda: None,
                args=("arg_1", "arg_2"),
                kwargs={"kwarg_1": "kwarg_1"},
                label_visibility="hidden",
                placeholder="placeholder 2",
                max_chars=50,
                type="password",
                autocomplete="auto2",
                icon="🔎",
            )
            c2 = self.get_delta_from_queue().new_element.text_input
            id2 = c2.id
            assert id1 == id2

    @parameterized.expand(
        [
            ("max_chars", 100, 200),
            ("validate", "^[a-z]+$", "^[0-9]+$"),
        ]
    )
    def test_whitelisted_stable_key_kwargs(
        self, kwarg_name: str, value1: object, value2: object
    ):
        """Test that the widget ID changes when a whitelisted kwarg changes even when the key is provided."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            st.text_input(
                label="Label 1",
                key="text_input_key",
                **{kwarg_name: value1},
            )
            c1 = self.get_delta_from_queue().new_element.text_input
            id1 = c1.id

            st.text_input(
                label="Label 2",
                key="text_input_key",
                **{kwarg_name: value2},
            )
            c2 = self.get_delta_from_queue().new_element.text_input
            id2 = c2.id
            assert id1 != id2

    def test_validate_message_does_not_change_stable_id(self):
        """Test that changing only the validate message keeps the same widget ID."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            st.text_input(
                label="Label 1",
                key="text_input_key",
                validate=("^[a-z]+$", "Lowercase only"),
            )
            c1 = self.get_delta_from_queue().new_element.text_input
            id1 = c1.id

            st.text_input(
                label="Label 2",
                key="text_input_key",
                validate=("^[a-z]+$", "Letters only"),
            )
            c2 = self.get_delta_from_queue().new_element.text_input
            id2 = c2.id
            assert id1 == id2

    @parameterized.expand(
        [
            ("absent", {}),
            ("none", {"validate": None}),
            ("empty_string", {"validate": ""}),
        ]
    )
    def test_falsy_validate_preserves_backwards_compatible_id(
        self, _name: str, validate_kwarg: dict
    ):
        """Test that an input without effective validation keeps the same
        widget ID as before `validate` became part of the identity.

        This guards against widget-ID churn on upgrade: a falsy `validate`
        (absent, ``None``, or ``""``) must not contribute to the element ID,
        otherwise pre-existing text inputs would reset and lose their session
        state. ``validate=""`` is a frontend no-op, so it must be treated the
        same as no validation here.
        """
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            st.text_input(
                label="Label",
                key="text_input_key",
                value="abc",
                max_chars=50,
                **validate_kwarg,
            )
            actual_id = self.get_delta_from_queue().new_element.text_input.id

            # Reproduce the pre-`validate` identity computation (i.e. without
            # the `validate` kwarg and using the old `key_as_main_identity`
            # whitelist). For a keyed widget, dg-derived keys are dropped, so
            # `dg=None` yields the same result as passing the real dg.
            expected_id = compute_and_register_element_id(
                "text_input",
                user_key="text_input_key",
                key_as_main_identity={"max_chars"},
                dg=None,
                label="Label",
                value="abc",
                max_chars=50,
                type="default",
                help=None,
                autocomplete=None,
                placeholder=str(None),
                icon=None,
                width="stretch",
            )
            assert actual_id == expected_id

    def test_bind_query_params_sets_query_param_key(self) -> None:
        """Test that bind='query-params' with a key sets query_param_key in proto."""
        st.text_input("the label", key="my_text", bind="query-params")

        c = self.get_delta_from_queue().new_element.text_input
        assert c.query_param_key == "my_text"

    def test_bind_query_params_without_key_raises_exception(self) -> None:
        """Test that bind='query-params' without a key raises an exception."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.text_input("the label", bind="query-params")

        assert "must have a unique 'key' parameter" in str(exc.value)

    def test_no_bind_does_not_set_query_param_key(self) -> None:
        """Test that without bind parameter, query_param_key is not set."""
        st.text_input("the label", key="my_text")

        c = self.get_delta_from_queue().new_element.text_input
        assert c.query_param_key == ""

    def test_invalid_bind_value_raises_exception(self) -> None:
        """Test that an invalid bind value raises StreamlitInvalidBindValueError."""
        with pytest.raises(StreamlitInvalidBindValueError) as exc:
            st.text_input("the label", key="my_text", bind="invalid-value")

        assert "invalid-value" in str(exc.value)
        assert "query-params" in str(exc.value)

    def test_bind_query_params_with_default_value(self) -> None:
        """Test that bind works with a default value."""
        st.text_input("the label", value="hello", key="my_text", bind="query-params")

        c = self.get_delta_from_queue().new_element.text_input
        assert c.query_param_key == "my_text"
        assert c.default == "hello"

    def test_bind_query_params_with_max_chars(self) -> None:
        """Test that bind works with max_chars."""
        st.text_input("the label", key="my_text", bind="query-params", max_chars=5)

        c = self.get_delta_from_queue().new_element.text_input
        assert c.query_param_key == "my_text"
        assert c.max_chars == 5

    def test_bind_query_params_with_password_raises_exception(self) -> None:
        """Test that bind='query-params' with type='password' raises an exception."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.text_input(
                "the label",
                key="my_text",
                bind="query-params",
                type="password",
            )

        assert "password" in str(exc.value).lower()


class SomeObj:
    pass


def test_text_input_interaction():
    """Test interactions with an empty text_input widget."""

    def script():
        import streamlit as st

        st.text_input("the label", value=None)

    at = AppTest.from_function(script).run()
    text_input = at.text_input[0]
    assert text_input.value is None

    # Input a value:
    at = text_input.input("Foo").run()
    text_input = at.text_input[0]
    assert text_input.value == "Foo"

    # # Clear the value
    at = text_input.set_value(None).run()
    text_input = at.text_input[0]
    assert text_input.value is None


def test_None_session_state_value_retained():
    def script():
        import streamlit as st

        if "text_input" not in st.session_state:
            st.session_state["text_input"] = None

        st.text_input("text_input", key="text_input")
        st.button("button")

    at = AppTest.from_function(script).run()
    at = at.button[0].click().run()
    assert at.text_input[0].value is None


def test_delete_session_state_key_pushes_default_to_frontend() -> None:
    """Deleting the key resets the widget in the browser too (issue #16388)."""

    def script() -> None:
        import streamlit as st

        st.text_input("Foo", value="default", key="foo")

        def delete() -> None:
            del st.session_state["foo"]

        st.button("Delete", on_click=delete)

    at = AppTest.from_function(script).run()
    at.text_input[0].set_value("hello").run()

    # The frontend still holds "hello" when the Delete button is clicked.
    at.text_input[0].set_value("hello")
    at = at.button[0].click().run()

    assert at.text_input[0].proto.set_value is True
    assert at.text_input[0].proto.value == "default"
