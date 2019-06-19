#!/bin/bash -e

for i in $(docker images | egrep '^streamlit/streamlit'|grep -v none|awk '{print $2}')
do
    docker push "streamlit/streamlit:${i}"
done
