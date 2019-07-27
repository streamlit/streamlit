import setuptools

from pipenv.project import Project
from pipenv.utils import convert_deps_to_pip

pfile = Project(chdir=False).parsed_pipfile
requirements = convert_deps_to_pip(pfile['packages'], r=False)

def readme():
    with open('README.md') as f:
        return f.read()

setuptools.setup(
    name='streamlit',
    version='0.44.0',  # PEP-440
    description='Streaming Data Science',
    long_description=readme(),
    url='https://streamlit.io',
    author='Streamlit Inc',
    author_email='hello@streamlit.io',
    license='MIT',

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
