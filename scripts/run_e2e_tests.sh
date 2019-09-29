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

# Runs end-to-end tests.

# Change working directory so script is run as ./scripts/e2e.sh
cwd=.

# Whether to prompt to continue on failure or run all
always_continue=false

# Records if any test fails so we can return appropriately after all run
any_failed=false

# Flag to record test results in the cypress dashboard
# Set to "--record" to turn on.
record_results_flag=

# Flag to update snapshots.
# Set to "--env updateSnapshots=true" to turn on.
snapshots_flag=

# Handle command line named arguments, passed as `-c .. -a true`
while getopts ":c:a:r:u" opt; do
  case $opt in
    c) cwd="$OPTARG"
    ;;
    a) always_continue="$OPTARG"
    ;;
    r) record_results_flag="--record"
    ;;
    u) snapshots_flag="--env updateSnapshots=true"
    ;;
    \?) echo "Invalid option -$OPTARG" >&2
    ;;
  esac
done

# Ensure -a is passed an allowed value
if [ "$always_continue" != "false" ] && [ "$always_continue" != "true" ]
then
  echo "-a must be true or false"
  exit 1
fi

# Kill all active "streamlit run" processes
pids=$(pgrep -f 'streamlit run')

if [ "$pids" ]
then
  kill -9 $pids
fi

# Set working directory
cd "$cwd"/frontend

# Generate report on exit
generate_report() {
  cd frontend
  npx -q mochawesome-merge --reportDir cypress/mochawesome > mochawesome.json
  npx -q mochawesome-report-generator mochawesome.json
}
trap generate_report EXIT

# Clear old results
rm cypress/mochawesome/* || true
rm mochawesome.json || true

# Test core streamlit elements
for file in ../e2e/scripts/*.py
do
  snapshots_flag_for_this_run=$snapshots_flag

  # Infinite loop to support retries.
  while true
  do
    # Run next test
    streamlit run $file &

    filename=$(basename $file)
    specpath="../e2e/specs/${filename%.*}.spec.ts"

    yarn \
      cy:run \
      --spec $specpath \
      $record_results_flag $snapshots_flag_for_this_run

    EXITCODE="$?"

    # Kill the last process executed in the background
    kill -9 $!

    # If exit code is nonzero, prompt user to continue or continue without prompting
    if [ "$EXITCODE" -ne "0" ] && [ "$always_continue" = "false" ]; then
      read -p "Retry, Update snapshots, Skip, or Quit? " key
      case $key in
        [Ss]* ) break ;;
        [Qq]* ) exit 1 ;;
        [Rr]* ) continue ;;
        [Uu]* ) snapshots_flag_for_this_run="--env updateSnapshots=true"; continue ;;
        * ) continue ;;  # Retry if key not recognized.
      esac
    elif [ "$EXITCODE" -ne "0" ] && [ "$always_continue" = "true" ]; then
      any_failed=true
    fi

    # If we got to this point, break out of the infite loop. No need to retry.
    break
  done
done

if [ "$any_failed" = "true" ]
then
  exit 1
fi
