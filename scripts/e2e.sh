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

  EXITCODE="$?"

  # Kill the last process executed in the background
  kill -9 $!

  # If exit code is nonzero, quit
  if [ "$EXITCODE" -ne "0" ]
  then
    echo "Test failed: ${file}"
    read -p "Continue? [y/n] " yn
    case $yn in
      [Yy]* ) continue ;;
      * ) exit 1 ;;
    esac
  fi
done
