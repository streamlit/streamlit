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

import json
import unittest

import pytest

import streamlit as st
from tests.delta_generator_test_case import DeltaGeneratorTestCase


@pytest.mark.require_integration
class PydanticIntegrationTest(unittest.TestCase):
    def pydantic_model_definition(self):
        from pydantic import (  # type: ignore[import-not-found]
            BaseModel,
            root_validator,
            validator,
        )

        class UserModel(BaseModel):
            name: str
            username: str
            password1: str
            password2: str

            @validator("name")
            def name_must_contain_space(cls, v):
                if " " not in v:
                    raise ValueError("must contain a space")
                return v.title()

            @root_validator()
            def passwords_should_match(cls, values):
                if values["password1"] != values["password2"]:
                    raise ValueError("passwords do not match")
                return values

        UserModel(
            name="John Doe",
            username="johndoe",
            password1="abcd",
            password2="abcd",
        )

    def test_pydantic_v1_validator(self):
        """Test that the pydantic model with a v1 validator can be
        redefined without exception.

        This only works in pydantic >= 2.0.0.

        https://github.com/streamlit/streamlit/issues/3218
        """

        # Check that the model  redefined without exception.
        self.pydantic_model_definition()
        self.pydantic_model_definition()


@pytest.mark.require_integration
class PydanticWriteJsonTest(DeltaGeneratorTestCase):
    """Test that st.write correctly handles Pydantic models via st.json."""

    def test_st_write_single_pydantic_model(self) -> None:
        """Test that st.write displays a single Pydantic model as JSON."""
        from pydantic import BaseModel

        class Person(BaseModel):
            name: str
            age: int

        st.write(Person(name="Alice", age=30))

        el = self.get_delta_from_queue().new_element
        body = json.loads(el.json.body)
        assert body == {"name": "Alice", "age": 30}

    def test_st_write_list_of_pydantic_models(self) -> None:
        """Test that st.write displays a list of Pydantic models as JSON."""
        from pydantic import BaseModel

        class Person(BaseModel):
            name: str
            age: int

        people = [Person(name="Bob", age=25), Person(name="Charlie", age=35)]
        st.write(people)

        el = self.get_delta_from_queue().new_element
        body = json.loads(el.json.body)
        assert body == [{"name": "Bob", "age": 25}, {"name": "Charlie", "age": 35}]

    def test_st_json_list_of_pydantic_models(self) -> None:
        """Test that st.json correctly serializes a list of Pydantic models."""
        from pydantic import BaseModel

        class Person(BaseModel):
            name: str
            age: int

        people = [Person(name="Bob", age=25), Person(name="Charlie", age=35)]
        st.json(people)

        el = self.get_delta_from_queue().new_element
        body = json.loads(el.json.body)
        assert body == [{"name": "Bob", "age": 25}, {"name": "Charlie", "age": 35}]
