export enum ScriptRunState {
  NOT_RUNNING = "notRunning",
  RUNNING = "running",
  RERUN_REQUESTED = "rerunRequested", // script *not* running, but user requested it be re-run
  STOP_REQUESTED = "stopRequested", // script *is* running, but user requested it be stopped
  COMPILATION_ERROR = "compilationError", // script failed with a compilation error
}
