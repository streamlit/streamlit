/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

export enum ReportRunState {
  NOT_RUNNING = 'notRunning',
  RUNNING = 'running',
  RERUN_REQUESTED = 'rerunRequested', // report *not* running, but user requested it be re-run
  STOP_REQUESTED = 'stopRequested',   // report *is* running, but user requested it be stopped
  COMPILATION_ERROR = 'compilationError' // report's script failed with a compilation error
}
