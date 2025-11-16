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

# ruff: noqa: INP001

import os
import sys
from pathlib import Path

from setuptools import find_packages, setup
from setuptools.command.install import install

THIS_DIRECTORY = Path(__file__).parent

VERSION = "1.51.1.dev20251115"  # PEP-440

# IMPORTANT: We should try very hard *not* to add dependencies to Streamlit.
# And if you do add one, make the required version as general as possible:
# - Include relevant lower bound for any features we use from our dependencies
# - Always include the lower bound as >= VERSION, to keep testing min versions easy
# - And include an upper bound that's < NEXT_MAJOR_VERSION
INSTALL_REQUIRES = [
    # Altair 5.4.0 and 5.4.1 have compatibility issues with narwhals library
    # that cause st.line_chart and other built-in charts to fail rendering.
    # See: https://github.com/streamlit/streamlit/issues/12064
    "altair>=4.0, <6, !=5.4.0, !=5.4.1",
    "blinker>=1.5.0, <2",
    "cachetools>=4.0, <7",
    "click>=7.0, <9",
    "numpy>=1.23, <3",
    "packaging>=20, <26",
    # Pandas <1.4 has a bug related to deleting columns in a DataFrame changing
    # the index dtype.
    "pandas>=1.4.0, <3",
    "pillow>=7.1.0, <13",
    # `protoc` < 3.20 is not able to generate protobuf code compatible with protobuf >= 3.20.
    "protobuf>=3.20, <7",
    # pyarrow is not semantically versioned, gets new major versions frequently, and
    # doesn't tend to break the API on major version upgrades, so we don't put an
    # upper bound on it.
    "pyarrow>=7.0",
    "requests>=2.27, <3",
    "tenacity>=8.1.0, <10",
    # Starting from Python 3.11, Python has built in support for reading TOML files.
    # Let's make sure to remove this "toml" library when we stop supporting Python 3.10.
    "toml>=0.10.1, <2",
    "typing-extensions>=4.4.0, <5",
    # Don't require watchdog on MacOS, since it'll fail without xcode tools.
    # Without watchdog, we fallback to a polling file watcher to check for app changes.
    "watchdog>=2.1.5, <7; platform_system != 'Darwin'",
]

# We want to exclude some dependencies in our internal Snowpark conda distribution of
# Streamlit. These dependencies will be installed normally for both regular conda builds
# and PyPI builds (that is, for people installing streamlit using either
# `pip install streamlit` or `conda install -c conda-forge streamlit`)
SNOWPARK_CONDA_EXCLUDED_DEPENDENCIES = [
    "gitpython>=3.0.7, <4, !=3.1.19",
    "pydeck>=0.8.0b4, <1",
    # Tornado 6.0.3 was the current version when Python 3.8 was released (Oct 14, 2019).
    # Tornado 6.5.0 is skipped due to a bug with Unicode characters in the filename.
    # See https://github.com/tornadoweb/tornado/commit/62c276434dc5b13e10336666348408bf8c062391
    "tornado>=6.0.3, <7, !=6.5.0",
]

if not os.getenv("SNOWPARK_CONDA_BUILD"):
    INSTALL_REQUIRES.extend(SNOWPARK_CONDA_EXCLUDED_DEPENDENCIES)

EXTRA_REQUIRES = {
    # Optional dependency required for Snowflake connection:
    "snowflake": [
        "snowflake-snowpark-python[modin]>=1.17.0; python_version<'3.12'",
        "snowflake-connector-python>=3.3.0; python_version<'3.12'",
    ],
    # Optional dependency required for PDF rendering:
    "pdf": [
        "streamlit-pdf>=1.0.0",
    ],
    # Optional dependency required for auth:
    "auth": [
        "Authlib>=1.3.2",
    ],
    # Optional charting dependencies:
    "charts": [
        "matplotlib>=3.0.0",
        "graphviz>=0.19.0",
        "plotly>=4.0.0",
        # orjson speeds up large plotly figure processing by 5-10x:
        "orjson>=3.5.0",
    ],
    # Optional SQL connection dependency:
    "sql": [
        "SQLAlchemy>=2.0.0",
    ],
    # Install all optional dependencies:
    "all": [
        "streamlit[auth,charts,snowflake,sql,pdf]",
        # Improved exception traceback formatting:
        "rich>=11.0.0",
    ],
}


class VerifyVersionCommand(install):
    """Custom command to verify that the git tag matches our version."""

    description = "verify that the git tag matches our version"

    def run(self):
        tag = os.getenv("TAG")

        if tag != VERSION:
            info = f"Git tag: {tag} does not match the version of this app: {VERSION}"
            sys.exit(info)


readme_path = THIS_DIRECTORY / ".." / "README.md"
if readme_path.exists():
    long_description = readme_path.read_text(encoding="utf-8")
else:
    # In some build environments (specifically in conda), we may not have the README file
    # readily available. In these cases, just let long_description be the empty string.
    # Note that long_description isn't used at all in these build environments, so it
    # being missing isn't problematic.
    long_description = ""

setup(
    name="streamlit-nightly",
    version=VERSION,
    description="A faster way to build and share data apps",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://streamlit.io",
    project_urls={
        "Source Code": "https://github.com/streamlit/streamlit",
        "Bug Tracker": "https://github.com/streamlit/streamlit/issues",
        "Release notes": "https://docs.streamlit.io/develop/quick-reference/changelog",
        "Documentation": "https://docs.streamlit.io/",
        "Community": "https://discuss.streamlit.io/",
        "Twitter": "https://twitter.com/streamlit",
    },
    author="Snowflake Inc",
    author_email="hello@streamlit.io",
    license="Apache License 2.0",
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Environment :: Console",
        "Environment :: Web Environment",
        "Intended Audience :: Developers",
        "Intended Audience :: Science/Research",
        "License :: OSI Approved :: Apache Software License",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Programming Language :: Python :: 3.13",
        "Topic :: Database :: Front-Ends",
        "Topic :: Office/Business :: Financial :: Spreadsheet",
        "Topic :: Scientific/Engineering :: Information Analysis",
        "Topic :: Scientific/Engineering :: Visualization",
        "Topic :: Software Development :: Libraries :: Application Frameworks",
        "Topic :: Software Development :: Widget Sets",
    ],
    python_requires=">=3.10",
    # PEP 561: https://mypy.readthedocs.io/en/stable/installed_packages.html
    package_data={"streamlit": ["py.typed", "hello/**/*.py"]},
    packages=find_packages(exclude=["tests", "tests.*"]),
    # Requirements
    install_requires=INSTALL_REQUIRES,
    extras_require=EXTRA_REQUIRES,
    zip_safe=False,  # install source files not egg
    include_package_data=True,  # copy html and friends
    entry_points={"console_scripts": ["streamlit = streamlit.web.cli:main"]},
    # For Windows so that streamlit * commands work ie.
    # - streamlit version
    # - streamlit hello
    scripts=["bin/streamlit.cmd"],
    cmdclass={
        "verify": VerifyVersionCommand,
    },
)
