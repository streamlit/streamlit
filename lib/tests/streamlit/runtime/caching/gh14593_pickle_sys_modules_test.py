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

"""Regression tests for gh-14593 (pickle vs sys.modules during hot reload)."""

from __future__ import annotations

import pickle
import sys
import types

import pytest


def test_pickling_fails_when_class_rebound_in_sys_modules() -> None:
    """Same failure mode as mid-run module eviction: stale __class__ vs sys.modules."""
    name = "_streamlit_gh14593_pickle_race_mod"
    mod1 = types.ModuleType(name)

    class Model:
        pass

    Model.__module__ = name
    Model.__qualname__ = "Model"
    mod1.Model = Model
    sys.modules[name] = mod1
    obj = Model()
    del sys.modules[name]

    mod2 = types.ModuleType(name)

    class Model:
        pass

    Model.__module__ = name
    Model.__qualname__ = "Model"
    mod2.Model = Model
    sys.modules[name] = mod2

    try:
        with pytest.raises(pickle.PicklingError):
            pickle.dumps(obj)
    finally:
        sys.modules.pop(name, None)


def test_pickling_succeeds_when_sys_modules_unchanged() -> None:
    """Pickle round-trips successfully when sys.modules is not mutated."""
    name = "_streamlit_gh14593_pickle_ok_mod"
    mod = types.ModuleType(name)

    class Model:
        pass

    Model.__module__ = name
    Model.__qualname__ = "Model"
    mod.Model = Model
    sys.modules[name] = mod
    try:
        obj = Model()
        assert isinstance(pickle.loads(pickle.dumps(obj)), Model)
    finally:
        sys.modules.pop(name, None)
