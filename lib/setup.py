# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import os
import setuptools
import sys

from setuptools.command.install import install

VERSION = "1.12.3.dev20220921"  # PEP-440

NAME = "streamlit-nightly"

DESCRIPTION = "The fastest way to build data apps in Python"

LONG_DESCRIPTION = (
    "Streamlit's open-source app framework is the easiest way "
    "for data scientists and machine learning engineers to "
    "create beautiful, performant apps in only a few hours! "
    "All in pure Python. All for free."
)

# IMPORTANT: We should try very hard *not* to add dependencies to Streamlit.
# And if you do add one, make the required version as general as possible.
# But include relevant lower bounds for any features we use from our dependencies.
INSTALL_REQUIRES = [
    "altair>=3.2.0",
    "blinker>=1.0.0",
    "cachetools>=4.0",
    "click>=7.0",
    # 1.4 introduced the functionality found in python 3.8's importlib.metadata module
    "importlib-metadata>=1.4",
    "numpy",
    "packaging>=14.1",
    "pandas>=0.21.0",
    "pillow>=6.2.0",
    # protobuf 3.20.2 is broken: https://github.com/protocolbuffers/protobuf/issues/10571
    "protobuf<4,>=3.12,!=3.20.2",
    "pyarrow>=4.0",
    "pydeck>=0.1.dev5",
    "pympler>=0.9",
    "python-dateutil",
    "requests>=2.4",
    "rich>=10.11.0",
    "semver",
    "toml",
    # 5.0 has a fix for etag header: https://github.com/tornadoweb/tornado/issues/2262
    "tornado>=5.0",
    "typing-extensions>=3.10.0.0",
    "tzlocal>=1.1",
    "validators>=0.2",
    # Don't require watchdog on MacOS, since it'll fail without xcode tools.
    # Without watchdog, we fallback to a polling file watcher to check for app changes.
    "watchdog; platform_system != 'Darwin'",
]

# We want to exclude some dependencies in our internal conda distribution of
# Streamlit.
CONDA_OPTIONAL_DEPENDENCIES = [
    "gitpython!=3.1.19",
]

# NOTE: ST_CONDA_BUILD is used here (even though CONDA_BUILD is set
# automatically when using the `conda build` command) because the
# `load_setup_py_data()` conda build helper function does not have the
# CONDA_BUILD environment variable set when it runs to generate our build
# recipe from meta.yaml.
if not os.getenv("ST_CONDA_BUILD"):
    INSTALL_REQUIRES.extend(CONDA_OPTIONAL_DEPENDENCIES)


class VerifyVersionCommand(install):
    """Custom command to verify that the git tag matches our version"""

    description = "verify that the git tag matches our version"

    def run(self):
        tag = os.getenv("CIRCLE_TAG")

        if tag != VERSION:
            info = "Git tag: {0} does not match the version of this app: {1}".format(
                tag, VERSION
            )
            sys.exit(info)


setuptools.setup(
    name=NAME,
    version=VERSION,
    description=DESCRIPTION,
    long_description=LONG_DESCRIPTION,
    url="https://streamlit.io",
    project_urls={
        "Source": "https://github.com/streamlit/streamlit",
    },
    author="Streamlit Inc",
    author_email="hello@streamlit.io",
    # We exclude Python 3.9.7 from our compatible versions due to a bug in that version
    # with typing.Protocol. See https://github.com/streamlit/streamlit/issues/5140 and
    # https://bugs.python.org/issue45121
    python_requires=">=3.7, !=3.9.7",
    license="Apache 2",
    # PEP 561: https://mypy.readthedocs.io/en/stable/installed_packages.html
    package_data={"streamlit": ["py.typed", "hello/**/*.py"]},
    packages=setuptools.find_packages(exclude=["tests", "tests.*"]),
    # Requirements
    install_requires=INSTALL_REQUIRES,
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
