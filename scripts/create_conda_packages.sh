#!/bin/sh
# Copyright 2018-2019 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

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
