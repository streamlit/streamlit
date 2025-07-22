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

import unittest

import pytest


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
