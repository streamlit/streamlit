import setuptools

from pipenv.project import Project
from pipenv.utils import convert_deps_to_pip
from sys import version_info

pipfile = Project(chdir=False).parsed_pipfile

# Combine [packages] with either [python3] or [python2]
packages = pipfile["packages"].copy()
if version_info.major == 2:
    packages.update(pipfile["python2"])
else:
    packages.update(pipfile["python3"])
requirements = convert_deps_to_pip(packages, r=False)


def readme():
    with open("README.md") as f:
        return f.read()


setuptools.setup(
    name="streamlit",
    version="0.45.0",  # PEP-440
    description="Magical developer tool for machine learning engineers",
    long_description=readme(),
    url="https://streamlit.io",
    author="Streamlit Inc",
    author_email="hello@streamlit.io",
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
)
