#!/bin/bash -e
## Used to run end-to-end tests

# Test core streamlit elements
for file in examples/core/*.py
do
  # Kill all "streamlit run" processes
  pkill -f "streamlit run"

  # Run next test
  streamlit run $file &
  yarn --cwd "frontend" cy:run --spec "cypress/integration/${file%.*}.spec.ts"
done
