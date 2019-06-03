#!/bin/bash -e
## Used to run end-to-end tests

# Test core streamlit elements
for file in examples/core/*.py
do
  # Kill all active "streamlit run" processes
  pgrep -f "streamlit run" | xargs kill -9

  # Run next test
  streamlit run $file &
  yarn --cwd "frontend" cy:run --spec "cypress/integration/${file%.*}.spec.ts"

  # Kill the last process executed in the background
  kill -9 $!
done
