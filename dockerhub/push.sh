#!/bin/bash -e

VERSION=$1

if [ -z "${VERSION}" ] ; then
  echo need to specify version to upload
  echo "$0 0.18.0"
  exit 1
fi

TAGS="
  2.7-${VERSION}
  3.5-${VERSION}
  3.6-${VERSION}
  2.7-${VERSION}-keras-tf
  3.5-${VERSION}-keras-tf
  3.6-${VERSION}-keras-tf
"

for TAG in ${TAGS} ; do
  docker push streamlit/streamlit:$TAG
done
