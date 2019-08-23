#!/bin/bash -e
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

# Usage:
#   Used by Makefile
#   $ ./anaconda_version.sh only
#   anaconda3-2018.12
#
#   Used by circle ci
#   $ scripts/anaconda_version.sh
#   export ANACONDA_VERSION=anaconda3-2018.12
#   export CONDA_VERSION=4.5.12
#   export PYTHON_VERSION=3.7.1

if conda info >/dev/null 2>&1; then
  CONDA_VERSION=$(conda info | egrep 'conda version' | awk '{print $4}')
  PYTHON_VERSION=$(python -c 'import platform; print(platform.python_version())')
  PYTHON_MAJOR_VERSION=$(python -c 'import sys; print(sys.version_info[0])')

  if conda list anaconda | grep -q ^anaconda ; then
    VERSION="$(conda list anaconda | egrep '^anaconda ' |awk '{print $2}')"
    ANACONDA_VERSION="anaconda${PYTHON_MAJOR_VERSION}-${VERSION}"
  else
    ANACONDA_VERSION="miniconda${PYTHON_MAJOR_VERSION}-${CONDA_VERSION}"
  fi

  if [ "$1" == "only" ] ; then
    echo "${ANACONDA_VERSION}"
  else
    echo "export ANACONDA_VERSION=${ANACONDA_VERSION}"
    echo "export CONDA_VERSION=${CONDA_VERSION}"
    echo "export PYTHON_VERSION=${PYTHON_VERSION}"
  fi
fi
