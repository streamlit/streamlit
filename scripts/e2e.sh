#!/bin/sh
## Used to run end-to-end tests

# Kill all active "streamlit run" processes
pids=$(pgrep -f 'streamlit run')

if [ "$pids" ]
then
  kill -9 $pids
fi

# Test core streamlit elements
for file in examples/core/*.py
do
  # Run next test
  streamlit run $file &
  yarn --cwd "frontend" cy:run --spec "cypress/integration/${file%.*}.spec.ts"

  # If exit code is nonzero, quit
  if [ "$?" -ne "0"]
  then
    exit 1
  fi

  # Kill the last process executed in the background
  kill -9 $!
done
