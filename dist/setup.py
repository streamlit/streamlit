from glob import iglob
import os
import setuptools
import sys

try:
    with open('requirements.txt') as requirements_file:
        requirements = [package.strip() \
            for package in requirements_file.readlines()]
except FileNotFoundError:
    raise RuntimeError('Missing package files. Try running `make package` first.')

def all_files(path):
    """Returns all files in a path excluding directories."""
    return [filename for filename in iglob(os.path.join(path, '*'))
        if not os.path.isdir(filename)]

setuptools.setup(
    name='streamlit',
    version='0.2',
    description='Streaming Data Science',
    url='https://github.com/treuille/streamlet-cloud',
    author='Adrien Treuille',
    author_email='adrien.g.treuille@gmail.com',
    license='MIT',
    packages=[
        'streamlit',
        'streamlit.local',
        'streamlit.shared',
        'streamlit.shared.protobuf',
    ],
    data_files=[
        ('streamlit/config', ['config.yaml']),
        ('streamlit/proxy_static', all_files('build')),
        ('streamlit/proxy_static/static/js', all_files('build/static/js')),
        ('streamlit/proxy_static/static/css', all_files('build/static/css')),
    ],
    install_requires=requirements,
    zip_safe=False
)
