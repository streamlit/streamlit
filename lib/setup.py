import platform
import setuptools
import subprocess

from pipenv.project import Project
from pipenv.utils import convert_deps_to_pip

pfile = Project(chdir=False).parsed_pipfile
requirements = convert_deps_to_pip(pfile['packages'], r=False)

# Check whether xcode tools are available before making watchdog a
# dependency (only if the current system is a Mac).
if (platform.system() == 'Darwin' and
        subprocess.call('xcode-select --version', shell=True) != 0):
    try:
        requirements.remove('watchdog')
    except ValueError:
        pass

def readme():
    with open('README.md') as f:
        return f.read()

setuptools.setup(
    name='streamlit',
    version='0.45.0',  # PEP-440
    description='Magical developer tool for machine learning engineers',
    long_description=readme(),
    url='https://streamlit.io',
    author='Streamlit Inc',
    author_email='hello@streamlit.io',
    license='Apache 2',

    packages = setuptools.find_packages(exclude=['tests', 'tests.*']),

    # Requirements
    install_requires = requirements,

    zip_safe = False,  # install source files not egg
    include_package_data = True,  # copy html and friends

    entry_points = {
        'console_scripts': [
            'streamlit = streamlit.cli:main',
        ],
    },

    # For Windows so that streamlit * commands work ie.
    # - streamlit version
    # - streamlit hello
    scripts=['bin/streamlit.cmd'],
)
