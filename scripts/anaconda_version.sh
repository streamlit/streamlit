#!/bin/bash -e
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
