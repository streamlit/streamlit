import os
import platform
import setuptools
import subprocess
import sys

from pipenv.project import Project
from pipenv.utils import convert_deps_to_pip
from setuptools.command.install import install

VERSION = "0.61.0"  # PEP-440

NAME = "streamlit"

pipfile = Project(chdir=False).parsed_pipfile

packages = pipfile["packages"].copy()
requirements = convert_deps_to_pip(packages, r=False)


# Check whether xcode tools are available before making watchdog a
# dependency (only if the current system is a Mac).
if platform.system() == "Darwin":
    has_xcode = subprocess.call(["xcode-select", "--version"], shell=False) == 0
    has_gcc = subprocess.call(["gcc", "--version"], shell=False) == 0

    if not (has_xcode and has_gcc):
        try:
            requirements.remove("watchdog")
        except ValueError:
            pass


def readme():
    with open("README.md") as f:
        return f.read()


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
    description="Frontend library for machine learning engineers",
    long_description=readme(),
    url="https://streamlit.io",
    author="Streamlit Inc",
    author_email="hello@streamlit.io",
    python_requires=">=3.6",
    license="Apache 2",
    packages=setuptools.find_packages(exclude=["tests", "tests.*"]),
    # Requirements
    install_requires=requirements,
    zip_safe=False,  # install source files not egg
    include_package_data=True,  # copy html and friends
    entry_points={"console_scripts": ["streamlit = streamlit.cli:main"]},
    # For Windows so that streamlit * commands work ie.
    # - streamlit version
    # - streamlit hello
    scripts=["bin/streamlit.cmd"],
    cmdclass={"verify": VerifyVersionCommand,},
)
