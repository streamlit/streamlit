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

import tempfile
from pathlib import Path
from unittest.mock import MagicMock, Mock, mock_open, patch

import pytest
from parameterized import parameterized

from streamlit.components.v2.manifest_scanner import (
    ComponentConfig,
    ComponentManifest,
    _derive_project_metadata,
    _extract_components,
    _is_likely_streamlit_component_package,
    _load_pyproject,
    _process_single_package,
    _validate_pyproject_for_package,
    scan_component_manifests,
)
from streamlit.errors import StreamlitComponentRegistryError


def test_component_config_from_dict_missing_name() -> None:
    """Test ComponentConfig.from_dict raises when name is missing."""
    with pytest.raises(ValueError, match="missing required 'name' field"):
        ComponentConfig.from_dict({})


def test_component_config_from_dict_empty_name() -> None:
    """Test ComponentConfig.from_dict raises when name is empty string."""
    with pytest.raises(ValueError, match="missing required 'name' field"):
        ComponentConfig.from_dict({"name": ""})


def test_component_config_from_dict_non_string_name() -> None:
    """Test ComponentConfig.from_dict raises when name is not a string."""
    with pytest.raises(ValueError, match="missing required 'name' field"):
        ComponentConfig.from_dict({"name": 123})


def test_component_config_from_dict_non_string_asset_dir() -> None:
    """Test ComponentConfig.from_dict raises when asset_dir is not a string."""
    with pytest.raises(ValueError, match="'asset_dir' must be a string"):
        ComponentConfig.from_dict({"name": "my-comp", "asset_dir": 42})


def test_component_config_parse_or_none_malformed() -> None:
    """Test ComponentConfig.parse_or_none returns None for malformed input."""
    result = ComponentConfig.parse_or_none({})
    assert result is None


def test_component_config_parse_or_none_valid() -> None:
    """Test ComponentConfig.parse_or_none returns config for valid input."""
    result = ComponentConfig.parse_or_none({"name": "my-comp", "asset_dir": "dist"})
    assert result is not None
    assert result.name == "my-comp"
    assert result.asset_dir == "dist"


def test_extract_components_no_streamlit_section() -> None:
    """Test _extract_components returns None when no streamlit section."""
    assert _extract_components({"project": {"name": "test"}}) is None


def test_extract_components_no_components_list() -> None:
    """Test _extract_components returns None when components is not a list."""
    data = {"tool": {"streamlit": {"component": {"components": "not-a-list"}}}}
    assert _extract_components(data) is None


def test_extract_components_empty_after_filtering() -> None:
    """Test _extract_components returns None when all items are filtered."""
    data = {"tool": {"streamlit": {"component": {"components": ["not-a-dict", 42]}}}}
    assert _extract_components(data) is None


def test_extract_components_valid() -> None:
    """Test _extract_components returns list of dicts for valid data."""
    data = {
        "tool": {
            "streamlit": {
                "component": {"components": [{"name": "foo"}, {"name": "bar"}]}
            }
        }
    }
    result = _extract_components(data)
    assert result is not None
    assert len(result) == 2


def test_load_pyproject_invalid_file() -> None:
    """Test _load_pyproject returns None for invalid TOML file."""
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "pyproject.toml"
        path.write_text("[[[invalid toml")
        assert _load_pyproject(path) is None


def test_load_pyproject_nonexistent_file() -> None:
    """Test _load_pyproject returns None for non-existent file."""
    assert _load_pyproject(Path("/nonexistent/pyproject.toml")) is None


def test_is_likely_streamlit_component_package_by_summary() -> None:
    """Test filter detects packages with 'streamlit' in summary."""
    dist = MagicMock()
    dist.name = "my-chart-lib"
    mock_metadata = MagicMock()
    metadata_dict = {"Summary": "A streamlit chart component"}
    mock_metadata.__getitem__.side_effect = metadata_dict.__getitem__
    mock_metadata.__contains__.side_effect = metadata_dict.__contains__
    dist.metadata = mock_metadata
    assert _is_likely_streamlit_component_package(dist) is True


def test_is_likely_streamlit_component_package_by_requires_dist() -> None:
    """Test filter detects packages that depend on streamlit."""
    dist = MagicMock()
    dist.name = "my-widget"
    mock_metadata = MagicMock()
    metadata_dict = {"Summary": "A widget library"}
    mock_metadata.__getitem__.side_effect = metadata_dict.__getitem__
    mock_metadata.__contains__.side_effect = metadata_dict.__contains__
    mock_metadata.get_all.return_value = ["streamlit>=1.0"]
    dist.metadata = mock_metadata
    assert _is_likely_streamlit_component_package(dist) is True


def test_is_likely_streamlit_component_package_metadata_error() -> None:
    """Test filter handles metadata parsing errors gracefully."""
    dist = MagicMock()
    dist.name = "my-package"
    mock_metadata = MagicMock()
    metadata_dict = {"Summary": "A plain widget library"}
    mock_metadata.__getitem__.side_effect = metadata_dict.__getitem__
    mock_metadata.__contains__.side_effect = metadata_dict.__contains__
    mock_metadata.get_all.side_effect = Exception("metadata parsing error")
    dist.metadata = mock_metadata
    assert _is_likely_streamlit_component_package(dist) is False


def test_derive_project_metadata_with_fallbacks() -> None:
    """Test _derive_project_metadata uses dist fallbacks when project table is empty."""
    dist = MagicMock()
    dist.name = "fallback-name"
    dist.version = "0.1.0"
    name, version = _derive_project_metadata({}, dist)
    assert name == "fallback-name"
    assert version == "0.1.0"


def test_derive_project_metadata_no_version() -> None:
    """Test _derive_project_metadata defaults to 0.0.0 when no version is available."""
    dist = MagicMock()
    dist.name = "pkg"
    dist.version = None
    _name, version = _derive_project_metadata({}, dist)
    assert version == "0.0.0"


@parameterized.expand(
    [
        ("hyphen_to_underscore", "my-awesome-component", "my_awesome_component"),
        ("no_change_simple", "simple", "simple"),
        (
            "already_normalized",
            "already_normalized_name",
            "already_normalized_name",
        ),
        (
            "preserve_dots_and_case",
            "Streamlit.Bokeh",
            "Streamlit.Bokeh",
        ),
        ("hyphen_replaced_before_dot", "foo-bar.baz", "foo_bar.baz"),
    ]
)
def test_normalize_package_name_param(_case: str, raw: str, expected: str) -> None:
    """Validate name normalization across representative cases."""
    from streamlit.components.v2.manifest_scanner import _normalize_package_name

    assert _normalize_package_name(raw) == expected


def test_process_single_package_no_files() -> None:
    """Test _process_single_package with distribution that has no files."""
    # Create mock distribution with no files
    mock_dist = Mock()
    mock_dist.files = None
    mock_dist.name = "test-package"

    result = _process_single_package(mock_dist)
    assert result is None


def test_process_single_package_no_pyproject() -> None:
    """Test _process_single_package with distribution that has no pyproject.toml."""
    # Create mock distribution with files but no pyproject.toml
    mock_file = Mock()
    mock_file.name = "some_file.py"

    mock_dist = Mock()
    mock_dist.files = [mock_file]
    mock_dist.name = "test-package"

    result = _process_single_package(mock_dist)
    assert result is None


def test_process_single_package_no_streamlit_config() -> None:
    """Test _process_single_package with pyproject.toml but no Streamlit config."""
    # Create mock file and distribution
    mock_file = Mock()
    mock_file.name = "pyproject.toml"

    mock_dist = Mock()
    mock_dist.files = [mock_file]
    mock_dist.name = "test-package"
    mock_dist.locate_file.return_value = "/path/to/pyproject.toml"

    # Mock toml content without Streamlit config
    toml_content = """
    [build-system]
    requires = ["setuptools"]

    [project]
    name = "test-package"
    """

    with (
        patch("builtins.open", mock_open(read_data=toml_content)),
        patch("streamlit.components.v2.manifest_scanner.toml.load") as mock_toml_load,
        patch("streamlit.components.v2.manifest_scanner.Path"),
    ):
        mock_toml_load.return_value = {
            "build-system": {"requires": ["setuptools"]},
            "project": {"name": "test-package"},
        }

        result = _process_single_package(mock_dist)
        assert result is None


def test_process_single_package_valid_manifest() -> None:
    """Test _process_single_package with valid Streamlit component manifest."""
    # Create mock file and distribution
    mock_file = Mock()
    mock_file.name = "pyproject.toml"

    mock_init_file = Mock()
    mock_init_file.__str__ = Mock(return_value="test_package/__init__.py")

    mock_dist = Mock()
    mock_dist.files = [mock_file, mock_init_file]
    mock_dist.name = "test-package"
    mock_dist.locate_file.side_effect = lambda f: (
        "/path/to/pyproject.toml"
        if f == mock_file
        else "/path/to/test_package/__init__.py"
    )

    with (
        patch("builtins.open", mock_open()),
        patch("streamlit.components.v2.manifest_scanner.toml.load") as mock_toml_load,
        patch("streamlit.components.v2.manifest_scanner.Path") as mock_path,
    ):
        mock_toml_load.return_value = {
            "project": {"name": "test-package", "version": "1.0.0"},
            "tool": {
                "streamlit": {
                    "component": {
                        "components": [
                            {
                                "name": "slider",
                                "js": "slider.js",
                                "css": "slider.css",
                            }
                        ],
                    }
                }
            },
        }

        # Mock Path behavior
        mock_path_instance = Mock()
        mock_path_instance.parent = "/path/to/test_package"
        mock_path.return_value = mock_path_instance

        result = _process_single_package(mock_dist)

        assert result is not None
        manifest, _package_root = result
        assert manifest.name == "test-package"
        assert manifest.version == "1.0.0"
        assert len(manifest.components) == 1
        assert manifest.components[0].name == "slider"


def test_scan_multiple_component_manifests() -> None:
    """Test that scanning handles multiple packages correctly."""
    # Create mock distributions with proper name and metadata attributes
    mock_dists = []
    for i in range(10):
        mock_dist = Mock()
        # Make some packages look like streamlit components
        if i < 5:
            mock_dist.name = f"streamlit-package-{i}"
            package_name = f"streamlit-package-{i}"
        else:
            mock_dist.name = f"package-{i}"
            package_name = f"package-{i}"

        # Mock metadata that returns proper strings
        mock_metadata = MagicMock()
        metadata_dict = {
            "Name": package_name,
            "Summary": f"Description for {package_name}",
        }
        mock_metadata.__getitem__.side_effect = metadata_dict.__getitem__
        mock_metadata.__contains__.side_effect = metadata_dict.__contains__
        mock_metadata.get_all.return_value = []
        mock_dist.metadata = mock_metadata
        mock_dists.append(mock_dist)

    results = []
    for i in range(3):  # Only 3 packages have valid manifests
        results.append(
            (
                ComponentManifest(
                    name=f"component_{i}",
                    version="1.0.0",
                    components=[ComponentConfig(name="test")],
                ),
                Path(f"/path/to/component_{i}"),
            )
        )

    with (
        patch(
            "streamlit.components.v2.manifest_scanner.importlib.metadata.distributions"
        ) as mock_distributions,
        patch(
            "streamlit.components.v2.manifest_scanner._process_single_package"
        ) as mock_process,
    ):
        mock_distributions.return_value = mock_dists
        mock_process.side_effect = lambda dist: (
            results[int(dist.name.split("-")[-1])]
            if "streamlit" in dist.name and int(dist.name.split("-")[-1]) < 3
            else None
        )

        manifests = scan_component_manifests(max_workers=2)

        # Should return 3 valid manifests
        assert len(manifests) == 3
        assert all(manifest.name.startswith("component_") for manifest, _ in manifests)


def test_scan_component_manifests_max_workers() -> None:
    """Test that max_workers parameter is respected."""
    # Create a small number of mock distributions with proper name and metadata attributes
    mock_dists = []
    for i in range(3):
        mock_dist = Mock()
        # Make all packages look like streamlit components for this test
        mock_dist.name = f"streamlit-package-{i}"
        package_name = f"streamlit-package-{i}"

        # Mock metadata that returns proper strings
        mock_metadata = MagicMock()
        metadata_dict = {
            "Name": package_name,
            "Summary": f"Description for {package_name}",
        }
        mock_metadata.__getitem__.side_effect = metadata_dict.__getitem__
        mock_metadata.__contains__.side_effect = metadata_dict.__contains__
        mock_metadata.get_all.return_value = []
        mock_dist.metadata = mock_metadata
        mock_dists.append(mock_dist)

    with (
        patch(
            "streamlit.components.v2.manifest_scanner.importlib.metadata.distributions"
        ) as mock_distributions,
        patch(
            "streamlit.components.v2.manifest_scanner._process_single_package"
        ) as mock_process,
        patch(
            "streamlit.components.v2.manifest_scanner.ThreadPoolExecutor"
        ) as mock_executor,
    ):
        mock_distributions.return_value = mock_dists
        mock_process.return_value = None

        # Mock the executor to work with as_completed
        mock_executor_instance = Mock()
        mock_executor.return_value.__enter__.return_value = mock_executor_instance
        mock_future = Mock()
        mock_future.result.return_value = None
        mock_executor_instance.submit.return_value = mock_future

        # Mock as_completed to return the futures immediately
        with patch(
            "streamlit.components.v2.manifest_scanner.as_completed"
        ) as mock_as_completed:
            mock_as_completed.return_value = [mock_future] * len(mock_dists)

            # Test with explicit max_workers
            scan_component_manifests(max_workers=2)
            mock_executor.assert_called_with(max_workers=2)

            # Test with default max_workers (should be limited by number of packages)
            scan_component_manifests()
            # Should use min(default, len(distributions), 16) = min(?, 3, 16) = 3
            assert mock_executor.call_args[1]["max_workers"] <= 3


def test_scan_component_manifests_empty_distributions() -> None:
    """Test scanning with no installed packages."""
    with patch(
        "streamlit.components.v2.manifest_scanner.importlib.metadata.distributions"
    ) as mock_distributions:
        mock_distributions.return_value = []

        manifests = scan_component_manifests()
        assert manifests == []


@parameterized.expand(
    [
        ("none_name", None),
        ("empty_string_name", ""),
    ]
)
def test_scan_component_manifests_skips_distributions_without_name(
    _case: str, dist_name: str | None
) -> None:
    """Test scanning skips distributions with missing or invalid dist.name."""
    invalid_dist = Mock()
    invalid_dist.name = dist_name
    invalid_metadata = MagicMock()
    invalid_metadata.__contains__.return_value = False
    invalid_metadata.get_all.return_value = []
    invalid_dist.metadata = invalid_metadata

    valid_dist = Mock()
    valid_dist.name = "streamlit-package-0"
    valid_metadata = MagicMock()
    metadata_dict = {
        "Name": "streamlit-package-0",
        "Summary": "Description for streamlit-package-0",
    }
    valid_metadata.__getitem__.side_effect = metadata_dict.__getitem__
    valid_metadata.__contains__.side_effect = metadata_dict.__contains__
    valid_metadata.get_all.return_value = []
    valid_dist.metadata = valid_metadata

    with (
        patch(
            "streamlit.components.v2.manifest_scanner.importlib.metadata.distributions"
        ) as mock_distributions,
        patch(
            "streamlit.components.v2.manifest_scanner._process_single_package"
        ) as mock_process,
    ):
        mock_distributions.return_value = [invalid_dist, valid_dist]
        mock_process.return_value = None

        # Should not raise, even with malformed distributions.
        manifests = scan_component_manifests(max_workers=1)

        assert manifests == []
        # Anti-regression: do not attempt to process the invalid distribution.
        mock_process.assert_called_once_with(valid_dist)


def test_scan_component_manifests_error_handling() -> None:
    """Test that scanning handles errors gracefully."""
    # Create mock distributions, some will cause errors
    mock_dists = []
    for i in range(5):
        mock_dist = Mock()
        # Make all packages look like streamlit components for this test
        mock_dist.name = f"streamlit-package-{i}"
        package_name = f"streamlit-package-{i}"

        # Mock metadata that returns proper strings
        mock_metadata = MagicMock()
        metadata_dict = {
            "Name": package_name,
            "Summary": f"Description for {package_name}",
        }
        mock_metadata.__getitem__.side_effect = metadata_dict.__getitem__
        mock_metadata.__contains__.side_effect = metadata_dict.__contains__
        mock_metadata.get_all.return_value = []
        mock_dist.metadata = mock_metadata
        mock_dists.append(mock_dist)

    def mock_process_with_errors(dist):
        if "package-2" in dist.name:
            # Simulate an error by returning None (what the real function does on error)
            return
        return  # For this test, all packages return None (no manifests found)

    with (
        patch(
            "streamlit.components.v2.manifest_scanner.importlib.metadata.distributions"
        ) as mock_distributions,
        patch(
            "streamlit.components.v2.manifest_scanner._process_single_package"
        ) as mock_process,
    ):
        mock_distributions.return_value = mock_dists
        mock_process.side_effect = mock_process_with_errors

        # Should not raise exception even with errors
        manifests = scan_component_manifests()
        assert manifests == []


# Tests for editable installs and _find_package_pyproject_toml function


@parameterized.expand(
    [
        (
            "project_name_match",
            '[project]\nname = "test-package"\n',
            (
                ("test-package", "test_package", True),
                ("test_package", "test_package", True),
                ("different-package", "different_package", False),
            ),
        ),
        (
            "requires_explicit_project_name",
            "[tool.streamlit.component]\ncomponents = []\n",
            (("test-package", "test_package", False),),
        ),
        (
            "no_match_other_tool",
            '[project]\nname = "different-package"\n\n[tool.other]\nconfig = "value"\n',
            (("test-package", "test_package", False),),
        ),
        (
            "invalid_file",
            "invalid toml content [[[",
            (("test-package", "test_package", False),),
        ),
        (
            "uses_package_name",
            '[project]\nname = "my_component"\n',
            (
                ("my-awesome-component", "my_component", True),
                ("different-component", "different_component", False),
            ),
        ),
        (
            "canonicalization_cases_streamlit_bokeh",
            '[project]\nname = "Streamlit.Bokeh"\n',
            (("streamlit-bokeh", "streamlit_bokeh", True),),
        ),
        (
            "canonicalization_cases_mixed_separators",
            '[project]\nname = "foo_-bar"\n',
            (("foo-bar", "foo_bar", True),),
        ),
        (
            "canonicalization_cases_upper_and_multiple",
            '[project]\nname = "FOO...BAR__BAZ"\n',
            (("foo-bar-baz", "foo_bar_baz", True),),
        ),
        (
            "canonicalization_negative",
            '[project]\nname = "streamlit.bokeh"\n',
            (("streamlit-other", "streamlit_other", False),),
        ),
    ]
)
def test_validate_pyproject_for_package_param(
    _case: str, pyproject_text: str, checks: tuple[tuple[str, str, bool], ...]
) -> None:
    """Validate pyproject parsing and name matching across many scenarios."""
    with tempfile.TemporaryDirectory() as temp_dir:
        pyproject_path = Path(temp_dir) / "pyproject.toml"
        pyproject_path.write_text(pyproject_text.strip())

        for dist_name, package_name, expected in checks:
            assert (
                _validate_pyproject_for_package(pyproject_path, dist_name, package_name)
                is expected
            )


def test_find_package_pyproject_toml_traditional_approach() -> None:
    """Test _find_package_pyproject_toml with traditional dist.files approach."""
    from streamlit.components.v2.manifest_scanner import _find_package_pyproject_toml

    # Create mock file and distribution
    mock_file = Mock()
    mock_file.name = "pyproject.toml"

    mock_dist = Mock()
    mock_dist.files = [mock_file]
    mock_dist.name = "test-package"
    mock_dist.locate_file.return_value = "/path/to/pyproject.toml"

    # Make sure read_text fails so it goes to the traditional approach
    mock_dist.read_text.side_effect = Exception("read_text not available")

    with (
        patch("streamlit.components.v2.manifest_scanner.Path") as mock_path_class,
        patch(
            "streamlit.components.v2.manifest_scanner._validate_pyproject_for_package"
        ) as mock_validate,
    ):
        # Create a real Path object that the function can use
        expected_path = Path("/path/to/pyproject.toml")
        mock_path_class.return_value = expected_path
        mock_validate.return_value = True

        result = _find_package_pyproject_toml(mock_dist)

        assert result == expected_path
        mock_dist.locate_file.assert_called_once_with(mock_file)
        mock_validate.assert_called_once_with(
            expected_path, "test-package", "test_package"
        )


def test_find_package_pyproject_toml_traditional_approach_fails() -> None:
    """Test _find_package_pyproject_toml when traditional approach fails but file exists."""
    from streamlit.components.v2.manifest_scanner import _find_package_pyproject_toml

    # Create mock file and distribution
    mock_file = Mock()
    mock_file.name = "pyproject.toml"

    mock_dist = Mock()
    mock_dist.files = [mock_file]
    mock_dist.name = "test-package"
    mock_dist.locate_file.side_effect = Exception("Failed to locate file")

    with (
        patch(
            "streamlit.components.v2.manifest_scanner.importlib.util.find_spec"
        ) as mock_find_spec,
        patch(
            "streamlit.components.v2.manifest_scanner._validate_pyproject_for_package"
        ) as mock_validate,
        tempfile.TemporaryDirectory() as temp_dir,
    ):
        # Create package directory
        package_dir = Path(temp_dir) / "test_package"
        package_dir.mkdir()

        # Mock importlib to find the package
        mock_spec = Mock()
        mock_spec.origin = str(package_dir / "__init__.py")
        mock_find_spec.return_value = mock_spec

        # Create pyproject.toml file in the package directory
        pyproject_path = package_dir / "pyproject.toml"
        pyproject_path.write_text("[project]\nname = 'test-package'")

        # Mock validation to return True
        mock_validate.return_value = True

        result = _find_package_pyproject_toml(mock_dist)

        assert result == pyproject_path
        mock_find_spec.assert_called_once_with("test_package")
        mock_validate.assert_called_once_with(
            pyproject_path, "test-package", "test_package"
        )


def test_find_package_pyproject_toml_editable_install() -> None:
    """Test _find_package_pyproject_toml with editable install (no dist.files)."""
    from streamlit.components.v2.manifest_scanner import _find_package_pyproject_toml

    mock_dist = Mock()
    mock_dist.files = None  # Simulates editable install
    mock_dist.name = "test-package"

    with (
        patch(
            "streamlit.components.v2.manifest_scanner.importlib.util.find_spec"
        ) as mock_find_spec,
        patch(
            "streamlit.components.v2.manifest_scanner._validate_pyproject_for_package"
        ) as mock_validate,
        tempfile.TemporaryDirectory() as temp_dir,
    ):
        # Create a real directory structure for testing
        package_dir = Path(temp_dir) / "test_package"
        package_dir.mkdir()
        pyproject_path = package_dir / "pyproject.toml"
        pyproject_path.write_text("[project]\nname = 'test-package'")

        # Mock importlib to find the package
        mock_spec = Mock()
        mock_spec.origin = str(package_dir / "__init__.py")
        mock_find_spec.return_value = mock_spec

        # Mock validation to return True
        mock_validate.return_value = True

        result = _find_package_pyproject_toml(mock_dist)

        assert result == pyproject_path
        mock_find_spec.assert_called_once_with("test_package")
        mock_validate.assert_called_once_with(
            pyproject_path, "test-package", "test_package"
        )


def test_find_package_pyproject_toml_no_parent_traversal() -> None:
    """Test _find_package_pyproject_toml does not traverse parent directories for security."""
    from streamlit.components.v2.manifest_scanner import _find_package_pyproject_toml

    mock_dist = Mock()
    mock_dist.files = None
    mock_dist.name = "test-package"

    with (
        patch(
            "streamlit.components.v2.manifest_scanner.importlib.util.find_spec"
        ) as mock_find_spec,
        patch(
            "streamlit.components.v2.manifest_scanner._validate_pyproject_for_package"
        ) as mock_validate,
        tempfile.TemporaryDirectory() as temp_dir,
    ):
        # Create a nested directory structure
        src_dir = Path(temp_dir) / "src"
        src_dir.mkdir()
        package_dir = src_dir / "test_package"
        package_dir.mkdir()

        # Create pyproject.toml in the root directory (parent of src/)
        pyproject_path = Path(temp_dir) / "pyproject.toml"
        pyproject_path.write_text("[project]\nname = 'test-package'")

        # Mock importlib to find the package
        mock_spec = Mock()
        mock_spec.origin = str(package_dir / "__init__.py")
        mock_find_spec.return_value = mock_spec

        # Mock validation to return True
        mock_validate.return_value = True

        result = _find_package_pyproject_toml(mock_dist)

        # For security, should NOT find pyproject.toml in parent directory
        assert result is None
        mock_find_spec.assert_called_once_with("test_package")
        # Should check package directory but not find pyproject.toml there
        mock_validate.assert_not_called()


def test_find_package_pyproject_toml_read_text_approach() -> None:
    """Test _find_package_pyproject_toml using dist.read_text() method for editable installs."""
    from streamlit.components.v2.manifest_scanner import _find_package_pyproject_toml

    # Create a mock file that looks like a Python file
    mock_file = Mock()
    mock_file.name = (
        "__init__.py"  # This will match the condition in the implementation
    )
    mock_file.__str__ = Mock(return_value="__init__.py")  # Make sure str(file) works

    mock_dist = Mock()
    mock_dist.files = [mock_file]
    mock_dist.name = "test-package"
    mock_dist.read_text.return_value = "[project]\nname = 'test-package'"

    with (
        patch(
            "streamlit.components.v2.manifest_scanner._validate_pyproject_for_package"
        ) as mock_validate,
        tempfile.TemporaryDirectory() as temp_dir,
    ):
        # Create a real pyproject.toml file that validation can find
        pyproject_path = Path(temp_dir) / "pyproject.toml"
        pyproject_path.write_text("[project]\nname = 'test-package'")

        # Mock locate_file to return a file in the same directory as pyproject.toml
        mock_dist.locate_file.return_value = Path(temp_dir) / "__init__.py"

        # Mock validation to return True
        mock_validate.return_value = True

        result = _find_package_pyproject_toml(mock_dist)

        assert result == pyproject_path
        mock_dist.read_text.assert_called_once_with("pyproject.toml")
        mock_validate.assert_called_once_with(
            pyproject_path, "test-package", "test_package"
        )


def test_find_package_pyproject_toml_path_distribution() -> None:
    """Test _find_package_pyproject_toml using Method 3 (find_spec) for editable installs."""
    from streamlit.components.v2.manifest_scanner import _find_package_pyproject_toml

    mock_dist = Mock()
    mock_dist.files = None  # No files to trigger Methods 1 and 2 failure
    mock_dist.name = "test-package"

    # Make sure read_text fails so it doesn't use Method 1
    mock_dist.read_text.side_effect = Exception("read_text not available")

    with (
        patch(
            "streamlit.components.v2.manifest_scanner.importlib.util.find_spec"
        ) as mock_find_spec,
        patch(
            "streamlit.components.v2.manifest_scanner._validate_pyproject_for_package"
        ) as mock_validate,
        tempfile.TemporaryDirectory() as temp_dir,
    ):
        # Create pyproject.toml in temp directory
        pyproject_path = Path(temp_dir) / "pyproject.toml"
        pyproject_path.write_text("[project]\nname = 'test-package'")

        # Mock find_spec to return a spec that points to our temp directory
        mock_spec = Mock()
        mock_spec.origin = str(Path(temp_dir) / "__init__.py")
        mock_find_spec.return_value = mock_spec

        # Mock validation to return True
        mock_validate.return_value = True

        result = _find_package_pyproject_toml(mock_dist)

        assert result == pyproject_path
        mock_validate.assert_called_once_with(
            pyproject_path, "test-package", "test_package"
        )


def test_find_package_pyproject_toml_validation_rejects_wrong_package() -> None:
    """Test _find_package_pyproject_toml when validation rejects wrong package."""
    from streamlit.components.v2.manifest_scanner import _find_package_pyproject_toml

    mock_dist = Mock()
    mock_dist.files = None
    mock_dist.name = "test-package"

    with (
        patch(
            "streamlit.components.v2.manifest_scanner.importlib.util.find_spec"
        ) as mock_find_spec,
        patch(
            "streamlit.components.v2.manifest_scanner._validate_pyproject_for_package"
        ) as mock_validate,
        tempfile.TemporaryDirectory() as temp_dir,
    ):
        # Create directory structure
        package_dir = Path(temp_dir) / "test_package"
        package_dir.mkdir()
        pyproject_path = package_dir / "pyproject.toml"
        pyproject_path.write_text(
            "[project]\nname = 'different-package'"
        )  # Wrong package

        # Mock importlib to find the package
        mock_spec = Mock()
        mock_spec.origin = str(package_dir / "__init__.py")
        mock_find_spec.return_value = mock_spec

        # Mock validation to return False (wrong package)
        mock_validate.return_value = False

        result = _find_package_pyproject_toml(mock_dist)

        assert result is None  # Should not find anything
        mock_validate.assert_called_once_with(
            pyproject_path, "test-package", "test_package"
        )


def test_find_package_pyproject_toml_read_text_fallback() -> None:
    """Test _find_package_pyproject_toml using read_text fallback method."""
    from streamlit.components.v2.manifest_scanner import _find_package_pyproject_toml

    mock_dist = Mock()
    mock_dist.name = "test-package"
    mock_dist.read_text.return_value = "[project]\nname = 'test-package'"

    # Mock importlib to fail
    with (
        patch(
            "streamlit.components.v2.manifest_scanner.importlib.util.find_spec"
        ) as mock_find_spec,
        patch(
            "streamlit.components.v2.manifest_scanner._validate_pyproject_for_package"
        ) as mock_validate,
        tempfile.TemporaryDirectory() as temp_dir,
    ):
        mock_find_spec.side_effect = Exception("Package not found")

        # Create some files to work with
        package_dir = Path(temp_dir) / "test_package"
        package_dir.mkdir()
        pyproject_path = package_dir / "pyproject.toml"
        pyproject_path.write_text("[project]\nname = 'test-package'")

        # Create a mock file that looks like a Python file
        mock_file = Mock()
        mock_file.name = "some_file.py"
        mock_file.__str__ = Mock(return_value="some_file.py")
        mock_dist.files = [mock_file]
        mock_dist.locate_file.return_value = str(package_dir / "some_file.py")

        # Mock validation to return True
        mock_validate.return_value = True

        result = _find_package_pyproject_toml(mock_dist)

        assert result == pyproject_path
        mock_dist.read_text.assert_called_once_with("pyproject.toml")
        mock_validate.assert_called_once_with(
            pyproject_path, "test-package", "test_package"
        )


def test_find_package_pyproject_toml_not_found() -> None:
    """Test _find_package_pyproject_toml when pyproject.toml cannot be found."""
    from streamlit.components.v2.manifest_scanner import _find_package_pyproject_toml

    mock_dist = Mock()
    mock_dist.files = None
    mock_dist.name = "test-package"

    # Mock importlib to fail
    with patch(
        "streamlit.components.v2.manifest_scanner.importlib.util.find_spec"
    ) as mock_find_spec:
        mock_find_spec.side_effect = Exception("Package not found")

        result = _find_package_pyproject_toml(mock_dist)

        assert result is None


def test_process_single_package_editable_install_success() -> None:
    """Test _process_single_package with successful editable install detection."""
    mock_dist = Mock()
    mock_dist.files = None  # Editable install
    mock_dist.name = "my-awesome-component"

    pyproject_content = {
        "project": {"name": "my-awesome-component", "version": "2.0.0"},
        "tool": {
            "streamlit": {
                "component": {
                    "components": [
                        {
                            "name": "slider",
                            "js": "slider.js",
                            "css": "slider.css",
                        }
                    ],
                }
            }
        },
    }

    with (
        patch(
            "streamlit.components.v2.manifest_scanner._find_package_pyproject_toml"
        ) as mock_find_pyproject,
        patch(
            "streamlit.components.v2.manifest_scanner.importlib.util.find_spec"
        ) as mock_find_spec,
        patch("builtins.open", mock_open()),
        patch("streamlit.components.v2.manifest_scanner.toml.load") as mock_toml_load,
        tempfile.TemporaryDirectory() as temp_dir,
    ):
        # Create real directories for testing
        package_dir = Path(temp_dir) / "my_awesome_component"
        package_dir.mkdir()
        pyproject_path = Path(temp_dir) / "pyproject.toml"
        pyproject_path.write_text("dummy content")

        # Mock the functions
        mock_find_pyproject.return_value = pyproject_path
        mock_toml_load.return_value = pyproject_content
        mock_spec = Mock()
        mock_spec.origin = str(package_dir / "__init__.py")
        mock_find_spec.return_value = mock_spec

        result = _process_single_package(mock_dist)

        assert result is not None
        manifest, package_root = result
        assert manifest.name == "my-awesome-component"
        assert manifest.version == "2.0.0"
        assert len(manifest.components) == 1
        assert manifest.components[0].name == "slider"
        assert package_root == package_dir


def test_process_single_package_editable_install_fallback_to_pyproject_parent() -> None:
    """Test _process_single_package falls back to pyproject.toml parent for package root."""
    mock_dist = Mock()
    mock_dist.files = None
    mock_dist.name = "test-component"

    pyproject_content = {
        "project": {"name": "test-component", "version": "1.0.0"},
        "tool": {
            "streamlit": {
                "component": {
                    "components": [{"name": "widget"}],
                }
            }
        },
    }

    with (
        patch(
            "streamlit.components.v2.manifest_scanner._find_package_pyproject_toml"
        ) as mock_find_pyproject,
        patch(
            "streamlit.components.v2.manifest_scanner.importlib.util.find_spec"
        ) as mock_find_spec,
        patch("builtins.open", mock_open()),
        patch("streamlit.components.v2.manifest_scanner.toml.load") as mock_toml_load,
        tempfile.TemporaryDirectory() as temp_dir,
    ):
        # Create pyproject.toml in temp directory
        pyproject_path = Path(temp_dir) / "pyproject.toml"
        pyproject_path.write_text("dummy content")

        # Mock functions
        mock_find_pyproject.return_value = pyproject_path
        mock_toml_load.return_value = pyproject_content
        # Mock importlib to fail finding the package (for both calls)
        mock_find_spec.side_effect = Exception("Package not found")

        result = _process_single_package(mock_dist)

        assert result is not None
        manifest, package_root = result
        assert manifest.name == "test-component"
        assert package_root == Path(temp_dir)  # Should be pyproject.toml parent


def test_process_single_package_mixed_install_scenarios() -> None:
    """Test _process_single_package handles mixed scenarios correctly."""
    mock_dist = Mock()
    mock_dist.files = None
    mock_dist.name = "mixed-component"

    pyproject_content = {
        "project": {"name": "mixed-component", "version": "1.5.0"},
        "tool": {
            "streamlit": {
                "component": {
                    "components": [{"name": "chart"}],
                }
            }
        },
    }

    with (
        patch(
            "streamlit.components.v2.manifest_scanner._find_package_pyproject_toml"
        ) as mock_find_pyproject,
        patch(
            "streamlit.components.v2.manifest_scanner.importlib.util.find_spec"
        ) as mock_find_spec,
        patch("builtins.open", mock_open()),
        patch("streamlit.components.v2.manifest_scanner.toml.load") as mock_toml_load,
        tempfile.TemporaryDirectory() as temp_dir,
    ):
        # Create real directories for testing
        package_dir = Path(temp_dir) / "mixed_component"
        package_dir.mkdir()
        pyproject_path = Path(temp_dir) / "pyproject.toml"
        pyproject_path.write_text("dummy content")

        # Mock functions
        mock_find_pyproject.return_value = pyproject_path
        mock_toml_load.return_value = pyproject_content
        mock_spec = Mock()
        mock_spec.origin = str(package_dir / "__init__.py")
        mock_find_spec.return_value = mock_spec

        result = _process_single_package(mock_dist)

        assert result is not None
        manifest, package_root = result
        assert manifest.name == "mixed-component"
        assert manifest.version == "1.5.0"
        assert package_root == package_dir


def test_resolve_asset_root_returns_none_for_unset_dir() -> None:
    """Test ComponentConfig.resolve_asset_root returns None when asset_dir is None."""
    config = ComponentConfig(name="comp")
    assert config.resolve_asset_root(Path("/tmp")) is None


def test_resolve_asset_root_raises_when_dir_missing(tmp_path: Path) -> None:
    """Test resolve_asset_root raises when asset_dir does not exist on disk."""
    config = ComponentConfig(name="comp", asset_dir="missing_dir")
    with pytest.raises(StreamlitComponentRegistryError, match="does not exist"):
        config.resolve_asset_root(tmp_path)


def test_resolve_asset_root_returns_path_when_present(tmp_path: Path) -> None:
    """Test resolve_asset_root resolves the asset directory under package_root."""
    asset_dir = tmp_path / "dist"
    asset_dir.mkdir()
    config = ComponentConfig(name="comp", asset_dir="dist")
    resolved = config.resolve_asset_root(tmp_path)
    assert resolved == asset_dir.resolve()


def test_validate_pyproject_uses_setuptools_package_name(tmp_path: Path) -> None:
    """Validate falls back to tool.setuptools.package-name when project name is absent."""
    pyproject_path = tmp_path / "pyproject.toml"
    pyproject_path.write_text(
        '[tool.setuptools]\npackage-name = "my-package"\n', encoding="utf-8"
    )
    assert (
        _validate_pyproject_for_package(pyproject_path, "my-package", "my_package")
        is True
    )


def test_process_single_package_no_pyproject_returns_none() -> None:
    """_process_single_package returns None when pyproject.toml is not found."""
    mock_dist = Mock()
    mock_dist.name = "test-package"

    with patch(
        "streamlit.components.v2.manifest_scanner._find_package_pyproject_toml",
        return_value=None,
    ):
        assert _process_single_package(mock_dist) is None


def test_process_single_package_returns_none_when_pyproject_unparseable(
    tmp_path: Path,
) -> None:
    """_process_single_package returns None when pyproject.toml cannot be parsed."""
    pyproject_path = tmp_path / "pyproject.toml"
    pyproject_path.write_text("[[[ invalid toml", encoding="utf-8")

    mock_dist = Mock()
    mock_dist.name = "test-package"

    with patch(
        "streamlit.components.v2.manifest_scanner._find_package_pyproject_toml",
        return_value=pyproject_path,
    ):
        assert _process_single_package(mock_dist) is None


def test_process_single_package_returns_none_when_only_malformed_components(
    tmp_path: Path,
) -> None:
    """_process_single_package returns None when no component entries parse cleanly."""
    pyproject_path = tmp_path / "pyproject.toml"
    pyproject_path.write_text(
        '[project]\nname = "test-package"\nversion = "1.0.0"\n\n'
        "[tool.streamlit.component]\n"
        'components = [{name = ""}, {name = 42}]\n',
        encoding="utf-8",
    )

    mock_dist = Mock()
    mock_dist.name = "test-package"
    mock_dist.version = "1.0.0"
    mock_dist.files = None

    with patch(
        "streamlit.components.v2.manifest_scanner._find_package_pyproject_toml",
        return_value=pyproject_path,
    ):
        # Components have invalid "name" fields so parse_or_none returns None
        # for each, leaving zero parsed components.
        assert _process_single_package(mock_dist) is None


def test_process_single_package_returns_none_on_unexpected_error() -> None:
    """_process_single_package swallows unexpected exceptions and returns None."""
    mock_dist = Mock()
    mock_dist.name = "test-package"

    with patch(
        "streamlit.components.v2.manifest_scanner._find_package_pyproject_toml",
        side_effect=RuntimeError("boom"),
    ):
        assert _process_single_package(mock_dist) is None


def test_scan_component_manifests_returns_empty_when_no_candidates() -> None:
    """scan_component_manifests returns an empty list when no candidate packages remain."""
    non_streamlit_dist = Mock()
    non_streamlit_dist.name = "unrelated-package"
    metadata = MagicMock()
    metadata_dict = {"Summary": "Nothing to see here"}
    metadata.__getitem__.side_effect = metadata_dict.__getitem__
    metadata.__contains__.side_effect = metadata_dict.__contains__
    metadata.get_all.return_value = []
    non_streamlit_dist.metadata = metadata

    with (
        patch(
            "streamlit.components.v2.manifest_scanner.importlib.metadata.distributions",
            return_value=[non_streamlit_dist],
        ),
        patch(
            "streamlit.components.v2.manifest_scanner._process_single_package"
        ) as mock_process,
    ):
        result = scan_component_manifests()

    assert result == []
    # Anti-regression: no per-package work should have been triggered.
    mock_process.assert_not_called()
