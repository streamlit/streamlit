/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export enum ScriptRunState {
  // TODO: Add INITIAL state here and clean up data-test-script-state in App.tsx.
  // But before we do this, we need to make sure Snowflake hosts that use this
  // state will not break. And that's a bigger project...
  //INITIAL = "initial",
  NOT_RUNNING = "notRunning",
  RUNNING = "running",
  RERUN_REQUESTED = "rerunRequested", // script *not* running, but user requested it be re-run
  STOP_REQUESTED = "stopRequested", // script *is* running, but user requested it be stopped
  COMPILATION_ERROR = "compilationError", // script failed with a compilation error
}
