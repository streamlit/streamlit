#!/bin/sh

CONDA_DIR=$(dirname $0)
CONDA_BASE=$(conda info -e | egrep '^base' | awk '{print $3}')
CONDA_BLD=${CONDA_BASE}/conda-bld

STREAMLIT_FORGE=/var/tmp/streamlit-conda/streamlit-forge

# Add conda-forge to local environment.  Streamlit package depends on
# some packages that exist on conda-forge.
conda config --add channels conda-forge || true

# delete old build files.
rm -rf ${CONDA_BLD}

# Build the packages
(cd ${CONDA_DIR}; conda build .)

# Copy the packages to a location to be indexed
mkdir -p ${STREAMLIT_FORGE}
rsync -av ${CONDA_BLD}/noarch/*.tar.bz2 ${STREAMLIT_FORGE}/noarch/

echo "Building index for ${STREAMLIT_FORGE}"
(cd ${STREAMLIT_FORGE}; conda index)
