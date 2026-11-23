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

"""Validate against the agent API's OpenAPI document with plain JSON Schema.

An OpenAPI 3.1 schema object is a JSON Schema 2020-12 schema, so `jsonschema`
and `referencing`, which come with Altair's `jsonschema` dependency, check the
document's schemas and validate requests and responses against them. The whole
document is registered as one resource, so a `$ref` such as
`#/components/schemas/Page` resolves within it, as an OpenAPI client resolves
it.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Final

from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

if TYPE_CHECKING:
    from collections.abc import Iterator

_DOCUMENT_URI: Final = "urn:streamlit:agent-api:openapi"


def _registry(document: dict[str, Any]) -> Registry[Any]:
    resource = Resource.from_contents(document, default_specification=DRAFT202012)
    return Registry().with_resource(_DOCUMENT_URI, resource)


def schema_validator(document: dict[str, Any], name: str) -> Draft202012Validator:
    """A validator for the component schema ``name`` of ``document``."""
    return Draft202012Validator(
        {"$ref": f"{_DOCUMENT_URI}#/components/schemas/{name}"},
        registry=_registry(document),
    )


def resolve_ref(document: dict[str, Any], ref: str) -> Any:
    """What ``ref``, a `$ref` in ``document``, points at.

    Raises
    ------
    referencing.exceptions.Unresolvable
        When it points at nothing in ``document``.
    """
    resolver = _registry(document).resolver(base_uri=_DOCUMENT_URI)
    return resolver.lookup(ref).contents


def iter_refs(node: Any) -> Iterator[str]:
    """Every `$ref` value in ``node``, at any depth."""
    if isinstance(node, dict):
        ref = node.get("$ref")
        if isinstance(ref, str):
            yield ref
        for value in node.values():
            yield from iter_refs(value)
    elif isinstance(node, list):
        for item in node:
            yield from iter_refs(item)
