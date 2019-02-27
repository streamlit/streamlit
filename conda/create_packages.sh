#!/bin/bash -e

# Add conda-forge to local environment.
conda config --add channels conda-forge || true

CONDA_BASE=$(conda info -e | egrep '^base' | awk '{print $3}')
CONDA_BLD=${CONDA_BASE}/conda-bld

# delete old build files.
rm -rf ${CONDA_BLD}

# Build the packages
conda build .
