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

"""Tests for the agent API's OpenAPI document."""

from __future__ import annotations

import json
import re
from typing import Any, Final, get_args

import pytest
from jsonschema import Draft202012Validator

from streamlit import config, version
from streamlit.elements.lib import agent_data, agent_spec
from streamlit.runtime.agent import errors, interaction, protocol, snapshot
from streamlit.runtime.state import query_params as query_params_state
from tests.streamlit.runtime.agent import openapi_validation

_INTERACT_PATH: Final = "/base/_stcore/agent/interact"
_SCHEMA_PATH: Final = "/base/_stcore/agent/openapi.json"
_HTTP_METHODS: Final = {"get", "put", "post", "delete", "options", "head", "patch"}


def _document(*, enabled: bool = True) -> dict[str, Any]:
    return protocol.build_openapi_document(
        interact_path=_INTERACT_PATH,
        schema_path=_SCHEMA_PATH,
        server_url="../../..",
        enabled=enabled,
    )


def _schemas(document: dict[str, Any]) -> dict[str, Any]:
    schemas: dict[str, Any] = document["components"]["schemas"]
    return schemas


def _operations(document: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        operation
        for item in document["paths"].values()
        for method, operation in item.items()
        if method in _HTTP_METHODS
    ]


@pytest.mark.parametrize("enabled", [True, False])
def test_the_document_is_valid_openapi(enabled: bool) -> None:
    """The document follows OpenAPI 3.1's rules, and every schema in it is a
    valid JSON Schema 2020-12 schema whose references resolve.
    """
    document = _document(enabled=enabled)

    assert document["openapi"] == "3.1.0"
    info = document["info"]
    assert isinstance(info["title"], str)
    assert info["title"]
    assert info["version"] == str(snapshot.SCHEMA_VERSION)
    # OpenAPI 3.1 allows a license `identifier` or a `url`, never both.
    assert info["license"] == {"name": "Apache 2.0", "identifier": "Apache-2.0"}
    [server] = document["servers"]
    assert not re.match(r"^[a-z][a-z0-9+.-]*:", server["url"])
    assert not server["url"].startswith("/")

    assert set(document["paths"]) == {_INTERACT_PATH, _SCHEMA_PATH}
    for path in document["paths"]:
        assert path.startswith("/")
        assert "{" not in path
    operations = _operations(document)
    operation_ids = [operation["operationId"] for operation in operations]
    assert sorted(operation_ids) == ["getOpenApiDocument", "interact"]
    for operation in operations:
        assert operation["responses"]
        for status, response in operation["responses"].items():
            assert status == "default" or re.fullmatch(r"[1-5]\d\d", status)
            assert response["description"]
            for media_type in response.get("content", {}).values():
                assert "schema" in media_type

    for schema in _schemas(document).values():
        Draft202012Validator.check_schema(schema)
    refs = set(openapi_validation.iter_refs(document))
    assert "#/components/schemas/Page" in refs
    for ref in refs:
        assert isinstance(openapi_validation.resolve_ref(document, ref), dict)


def test_every_catalog_code_is_documented_with_its_status() -> None:
    """The error codes are the catalog's, in its order, each with its HTTP
    status and meaning, and the interact operation documents the 202 a run
    still going gets.
    """
    document = _document()
    code = _schemas(document)["Error"]["properties"]["error"]["properties"]["code"]

    assert code["enum"] == list(errors.ERROR_CATALOG)
    for name in errors.ERROR_CATALOG:
        assert f"- `{name}` ({errors.error_status(name)}): " in code["description"]
    assert "- `wait_timed_out` (202): " in code["description"]
    responses = document["paths"][_INTERACT_PATH]["post"]["responses"]
    assert set(responses) == {"200", "202", "default"}
    assert "`wait_timed_out`" in responses["202"]["description"]


def test_documented_request_fields_match_the_validator() -> None:
    """The request, trigger, and context properties are the fields the
    validator accepts, in its order, and nothing else is allowed; the locale's
    limits are the validator's.
    """
    schemas = _schemas(_document())
    request = schemas["InteractRequest"]
    trigger = schemas["Trigger"]
    context = request["properties"]["context"]

    assert list(request["properties"]) == list(interaction.REQUEST_FIELDS)
    assert list(trigger["properties"]) == list(interaction.TRIGGER_FIELDS)
    assert list(context["properties"]) == list(interaction.CONTEXT_FIELDS)
    for schema in (request, trigger, context):
        assert schema["additionalProperties"] is False
    locale = context["properties"]["locale"]
    assert locale["maxLength"] == interaction.MAX_LOCALE_LENGTH
    query_params = request["properties"]["query_params"]["description"]
    assert str(query_params_state.CLIENT_STATE_QUERY_STRING_MAX_FIELDS) in query_params
    assert str(query_params_state.CLIENT_STATE_QUERY_STRING_MAX_LENGTH) in query_params


@pytest.mark.parametrize(
    ("locale", "accepted"),
    [("de-DE", True), ("zh-Hans-CN", True), ("en_US.UTF-8", False), ("", False)],
)
def test_the_documented_locale_pattern_agrees_with_the_validator(
    locale: str, accepted: bool
) -> None:
    """The schema accepts a locale exactly when the validator does, although a
    JSON Schema pattern matches anywhere in the text.
    """
    document = _document()
    validator = openapi_validation.schema_validator(document, "InteractRequest")

    assert validator.is_valid({"context": {"locale": locale}}) is accepted
    assert bool(interaction.LANGUAGE_TAG.fullmatch(locale)) is accepted


@pytest.mark.parametrize(
    "request_body",
    [
        *({name: None} for name in interaction.REQUEST_FIELDS),
        *({"context": {name: None}} for name in interaction.CONTEXT_FIELDS),
    ],
    ids=json.dumps,
)
def test_the_schema_accepts_null_exactly_where_the_validator_does(
    request_body: dict[str, Any],
) -> None:
    """`null` in a request or context field is valid in the schema exactly
    when the validator accepts it: everywhere as an omitted field, except in
    `session_id`, where it would silently start a fresh session.
    """
    validator = openapi_validation.schema_validator(_document(), "InteractRequest")
    try:
        interaction._validate_request_shape(request_body)
    except errors.AgentRequestError:
        accepted = False
    else:
        accepted = True

    assert validator.is_valid(request_body) is accepted
    assert accepted is ("session_id" not in request_body)


def test_documented_enumerations_match_their_sources() -> None:
    """Each enumeration lists its `Literal`'s values in order, and its
    description says something about every one of them.
    """
    schemas = _schemas(_document())
    node = schemas["Node"]["properties"]
    enumerations = {
        "status": (
            schemas["Snapshot"]["properties"]["status"],
            snapshot.SnapshotStatus,
        ),
        "support": (node["support"], agent_spec.SupportReason),
        "kind": (schemas["Action"]["properties"]["kind"], agent_spec.ActionKind),
        "unavailable": (
            schemas["ElementData"]["properties"]["unavailable"],
            agent_data.UnavailableReason,
        ),
    }

    for name, (schema, source) in enumerations.items():
        values = list(get_args(source))
        assert schema["enum"] == values, name
        bullets = re.findall(r"^- `(\w+)`: \S", schema["description"], re.MULTILINE)
        assert bullets == values, name


@pytest.mark.parametrize(
    "prose",
    [{"value": "Set."}, {"value": "Set.", "trigger": "Fire.", "gone": "Stale."}],
    ids=["missing", "stale"],
)
def test_prose_must_cover_exactly_the_defined_values(prose: dict[str, str]) -> None:
    """A value without prose, or prose for a value that is not defined, stops
    the document from being built.
    """
    with pytest.raises(KeyError, match="Documented"):
        protocol._bullets(get_args(agent_spec.ActionKind), prose)


def test_examples_match_the_request_schema() -> None:
    """Every request example is a valid request, and a request with an unknown
    field is not.
    """
    document = _document()
    validator = openapi_validation.schema_validator(document, "InteractRequest")
    examples = document["paths"][_INTERACT_PATH]["post"]["requestBody"]["content"][
        "application/json"
    ]["examples"]

    assert examples
    for name, example in examples.items():
        assert validator.is_valid(example["value"]), name
    assert not validator.is_valid({"session_id": "s_1", "bogus": True})
    assert not validator.is_valid({"session_id": "s_1", "trigger": {}})


def test_the_disabled_document_only_reports_that() -> None:
    """With the API off, the document says so and how to turn it on, documents
    only the interact operation's refusal, and leaves out the exact Streamlit
    version and everything describing a run.
    """
    disabled = _document(enabled=False)
    enabled = _document()

    info = disabled["info"]
    assert info["x-streamlit-agent-api"] == "disabled"
    assert "x-streamlit-version" not in info
    assert "--server.enableAgentApi=true" in info["description"]
    assert "403 not_available" in info["description"]
    interact = disabled["paths"][_INTERACT_PATH]["post"]
    assert set(interact["responses"]) == {str(errors.error_status("not_available"))}
    assert "requestBody" not in interact
    assert set(_schemas(disabled)) == {"Error", "Page"}
    assert disabled["servers"] == enabled["servers"]

    assert enabled["info"]["x-streamlit-agent-api"] == "available"
    assert enabled["info"]["x-streamlit-version"] == version.STREAMLIT_VERSION_STRING
    assert "Snapshot" in _schemas(enabled)


@pytest.mark.parametrize("enabled", [True, False])
def test_every_option_the_document_names_exists(enabled: bool) -> None:
    """Every configuration option the prose names is a real option."""
    rendered = json.dumps(_document(enabled=enabled))

    named_options = set(re.findall(r"`((?:server|client)\.\w+)`", rendered))
    assert "server.enableAgentApi" in named_options
    for option in named_options:
        assert option in config._config_options, option
