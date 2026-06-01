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

"""Regression tests for FIPS-friendly internal hashing."""

from __future__ import annotations

import ast
import hashlib
from pathlib import Path
from typing import Any

import pytest

from streamlit import util
from streamlit.runtime.caching.cache_type import CacheType
from streamlit.runtime.caching.cache_utils import _make_function_key, _make_value_key
from streamlit.runtime.memory_media_file_storage import _calculate_file_id
from streamlit.watcher.util import calc_hash_with_blocking_retries

_STREAMLIT_PACKAGE_ROOT = Path(__file__).parents[2] / "streamlit"
_FIPS_SENSITIVE_HASHLIB_ALGORITHMS = {"md5", "sha1", "blake2b", "blake2s"}
# Directories below the package root that are not part of Streamlit's own
# runtime hashing and therefore should not be held to the FIPS rule: vendored
# third-party code and shipped example-app templates.
_EXCLUDED_DIRECTORY_NAMES = {"vendor", ".agents"}


class _HashlibCallVisitor(ast.NodeVisitor):
    def __init__(self, filename: Path) -> None:
        self.filename = filename
        self.hashlib_aliases: set[str] = set()
        self.hashlib_new_aliases: set[str] = set()
        self.hash_constructor_aliases: dict[str, str] = {}
        self.violations: list[str] = []

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            if alias.name == "hashlib":
                self.hashlib_aliases.add(alias.asname or alias.name)

        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        if node.module != "hashlib":
            self.generic_visit(node)
            return

        for alias in node.names:
            local_name = alias.asname or alias.name
            if alias.name == "*":
                # A wildcard import pulls every public hashlib name into scope,
                # including `new` and the FIPS-sensitive constructors, so track
                # them all to keep the guard from being bypassed silently.
                self.hashlib_new_aliases.add("new")
                for algorithm in _FIPS_SENSITIVE_HASHLIB_ALGORITHMS:
                    self.hash_constructor_aliases[algorithm] = algorithm
            elif alias.name == "new":
                self.hashlib_new_aliases.add(local_name)
            elif alias.name in _FIPS_SENSITIVE_HASHLIB_ALGORITHMS:
                self.hash_constructor_aliases[local_name] = alias.name

        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        algorithm = self._get_fips_sensitive_algorithm(node)
        if algorithm is not None and not self._passes_usedforsecurity_false(node):
            self.violations.append(
                f"{self.filename}:{node.lineno} uses hashlib {algorithm!r} without "
                "usedforsecurity=False"
            )

        self.generic_visit(node)

    def _get_fips_sensitive_algorithm(self, node: ast.Call) -> str | None:
        func = node.func

        # Attribute access on the hashlib module, e.g. `hashlib.md5(...)`
        # or `hashlib.new("md5")`.
        if (
            isinstance(func, ast.Attribute)
            and isinstance(func.value, ast.Name)
            and func.value.id in self.hashlib_aliases
        ):
            if func.attr in _FIPS_SENSITIVE_HASHLIB_ALGORITHMS:
                return func.attr
            if func.attr == "new":
                return self._get_hashlib_new_algorithm(node)

        # Direct call of a name imported from hashlib, e.g. `md5(...)`
        # or `new("md5")`.
        if isinstance(func, ast.Name):
            if func.id in self.hash_constructor_aliases:
                return self.hash_constructor_aliases[func.id]
            if func.id in self.hashlib_new_aliases:
                return self._get_hashlib_new_algorithm(node)

        return None

    @staticmethod
    def _get_hashlib_new_algorithm(node: ast.Call) -> str | None:
        # The algorithm can be passed positionally (`new("md5")`) or by
        # keyword (`new(name="md5")`).
        algorithm_arg: ast.expr | None = node.args[0] if node.args else None
        if algorithm_arg is None:
            algorithm_arg = next(
                (kw.value for kw in node.keywords if kw.arg == "name"), None
            )

        if not isinstance(algorithm_arg, ast.Constant) or not isinstance(
            algorithm_arg.value, str
        ):
            return None

        algorithm = algorithm_arg.value.lower()
        if algorithm in _FIPS_SENSITIVE_HASHLIB_ALGORITHMS:
            return algorithm

        return None

    @staticmethod
    def _passes_usedforsecurity_false(node: ast.Call) -> bool:
        return any(
            keyword.arg == "usedforsecurity"
            and isinstance(keyword.value, ast.Constant)
            and keyword.value.value is False
            for keyword in node.keywords
        )


def test_fips_sensitive_hashlib_calls_disable_security_use() -> None:
    """Require explicit non-security use for FIPS-sensitive hashlib algorithms.

    The scan inspects static algorithm names only. Calls that build the
    algorithm name dynamically (e.g. ``hashlib.new(algo_var)``) cannot be
    resolved at parse time and are therefore not covered by this guard.
    """
    violations: list[str] = []

    for path in _STREAMLIT_PACKAGE_ROOT.rglob("*.py"):
        relative_parts = path.relative_to(_STREAMLIT_PACKAGE_ROOT).parts
        if _EXCLUDED_DIRECTORY_NAMES.intersection(relative_parts):
            continue

        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        visitor = _HashlibCallVisitor(path)
        visitor.visit(tree)
        violations.extend(visitor.violations)

    assert violations == []


@pytest.mark.parametrize(
    ("source", "expect_violation"),
    [
        # Attribute access on the hashlib module.
        ("import hashlib\nhashlib.md5(b'x')\n", True),
        ("import hashlib\nhashlib.md5(b'x', usedforsecurity=False)\n", False),
        # Aliased module and `hashlib.new` (positional and keyword).
        ("import hashlib as h\nh.new('sha1', b'x')\n", True),
        ("import hashlib\nhashlib.new(name='blake2b')\n", True),
        # Names imported directly from hashlib.
        ("from hashlib import blake2b\nblake2b(b'x')\n", True),
        # Wildcard imports bring the constructors into scope too.
        ("from hashlib import *\nblake2b(b'x')\n", True),
        ("from hashlib import *\nblake2b(b'x', usedforsecurity=False)\n", False),
        # Non-sensitive algorithms and dynamic names are not flagged.
        ("import hashlib\nhashlib.sha256(b'x')\n", False),
        ("import hashlib\nalgo = 'md5'\nhashlib.new(algo)\n", False),
    ],
)
def test_hashlib_visitor_flags_fips_sensitive_calls(
    source: str, expect_violation: bool
) -> None:
    """Detect FIPS-sensitive hashlib calls, including via wildcard imports."""
    visitor = _HashlibCallVisitor(Path("snippet.py"))
    visitor.visit(ast.parse(source))

    assert bool(visitor.violations) is expect_violation


def test_internal_hashing_works_when_fips_rejects_security_blake2b(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Exercise internal hashes with a FIPS-like provider restriction."""
    real_blake2b = hashlib.blake2b

    def fips_blake2b(*args: Any, **kwargs: Any) -> Any:
        if kwargs.get("usedforsecurity", True) is not False:
            raise ValueError("FIPS mode blocks BLAKE2b for security use")

        return real_blake2b(*args, **kwargs)

    monkeypatch.setattr(hashlib, "blake2b", fips_blake2b)

    assert util.calc_hash("streamlit") == util.calc_hash(b"streamlit")

    def cached_func(value: int) -> int:
        return value

    assert _make_function_key(CacheType.DATA, cached_func)
    assert _make_value_key(
        CacheType.DATA,
        cached_func,
        func_args=({"value": [1, 2, 3]},),
        func_kwargs={},
        hash_funcs=None,
    )
    assert _calculate_file_id(b"media-data", "text/plain", "media.txt")

    watched_file = tmp_path / "watched.py"
    watched_file.write_text("print('changed')", encoding="utf-8")

    assert calc_hash_with_blocking_retries(str(watched_file))
