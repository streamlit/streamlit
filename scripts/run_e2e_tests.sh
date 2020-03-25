#!/bin/bash
# Copyright 2018-2020 Streamlit Inc.
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

# Parent folder of the specs and scripts.
# 'e2e' for tests we expect to pass or 'e2e_flaky' for tests with known issues.
specs_parent_folder="e2e"

# Handle command line named arguments, passed as `-c .. -a true`
while getopts ":c:a:r:u:f" opt; do
  case $opt in
    c) cwd="$OPTARG"
    ;;
    a) always_continue="$OPTARG"
    ;;
    r) record_results_flag="--record"
    ;;
    u) snapshots_flag="--env updateSnapshots=true"
    ;;
    f) specs_parent_folder="e2e_flaky"
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
  npx -q mochawesome-merge --reportDir cypress/mochawesome > mochawesome.json
  npx -q mochawesome-report-generator mochawesome.json
}
trap generate_report EXIT

# Clear old results
rm cypress/mochawesome/* || true
rm mochawesome.json || true


# Takes as input all the arguments that should be passed to the "streamlit" CLI
# tool for the test. For example:
# - run_test run foo.py
# - run_test run foo.py --server.port=1234
# - run_test hello
function run_test {
  # Get path of test spec to execute.
  # If the user called "run_test run arg2", then the spec is the one for arg2.
  # Otherwise, we'll just use the hello spec.
  if [ $1 = "run" ]
  then
    file=$2
    filename=$(basename $file)
    specpath="../$specs_parent_folder/specs/${filename%.*}.spec.ts"
  else
    specpath="../e2e/specs/st_hello.spec.ts"
  fi

  # Infinite loop to support retries.
  while true
  do
    # Run next test
    streamlit "$@" &

    yarn \
      cy:run \
      --spec $specpath \
      --config integrationFolder=../$specs_parent_folder/specs \
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
}

# Test "streamlit hello" in different combinations.

credentials_file=~/.streamlit/credentials.toml
mkdir -p $(dirname $credentials_file)

if test -f $credentials_file
then
  mv $credentials_file $credentials_file.bak
fi

# Don't run this due to credentials prompt.
# run_test hello --server.headless=false

run_test hello --server.headless=true

cat << EOF > $credentials_file
[general]
email = "test@streamlit.io"
EOF

run_test hello --server.headless=false
run_test hello --server.headless=true

rm $credentials_file

if test -f $credentials_file.bak
then
  mv $credentials_file.bak $credentials_file
fi


# Test core streamlit elements

for file in ../$specs_parent_folder/scripts/*.py
do
  snapshots_flag_for_this_run=$snapshots_flag
  run_test run $file
done

if [ "$any_failed" = "true" ]
then
  exit 1
fi
