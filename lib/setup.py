# -*- coding: future_fstrings -*-

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.future import setup_2_3_compatibility
setup_2_3_compatibility(globals())

import setuptools

try: # for pip >= 10
    from pip._internal.req import parse_requirements
except ImportError: # for pip <= 9.0.3
    from pip.req import parse_requirements

requirements = parse_requirements('install_requirements.txt', session=False)

def readme():
    with open('README.md') as f:
        return f.read()

setuptools.setup(
    name='streamlit',
    version='0.11.1',  # PEP-440
    description='Streaming Data Science',
    long_description=readme(),
    url='https://github.com/treuille/streamlet-cloud',
    author='Adrien Treuille',
    author_email='adrien.g.treuille@gmail.com',
    license='MIT',

    packages = setuptools.find_packages(exclude=['tests', 'tests.*']),

    # Requirements
    install_requires = [str(x.req) for x in requirements],

    zip_safe = False,  # install source files not egg
    include_package_data = True,  # copy html and friends
)
