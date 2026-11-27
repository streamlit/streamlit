/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

/** Milestones reported on a run's pageProfile metrics event. */
export interface RunMilestones {
  appShellReadyMs?: number
  connectedMs?: number
  scriptFinishedMs: number
}

interface Run {
  startAt: number
  appShellReadyAt?: number
  connectedAt?: number
}

/**
 * Records when each script run reached the loading milestones known by the
 * time its PageProfile message is handled, for MetricsEvent's
 * app_shell_ready_ms, connected_ms and script_finished_ms. Times are measured
 * from the start of the run: navigation start for the first run of a page
 * load, otherwise the first rerun request sent since the previous run
 * started, or the run's NewSession if the browser didn't request it.
 */
export class RunMilestonesTracker {
  private readonly now: () => number

  private appShellReadyAt?: number

  private pendingRequestAt?: number

  private hasStartedRun = false

  private run?: Run

  constructor(now: () => number = () => performance.now()) {
    this.now = now
  }

  /** Called when the frontend app mounts. */
  public appMounted(): void {
    this.appShellReadyAt ??= this.now()
  }

  /** Called when the browser sends a rerun request. */
  public rerunRequested(): void {
    this.pendingRequestAt ??= this.now()
  }

  /** Called when a NewSession message starts a run. */
  public runStarted(): void {
    const now = this.now()
    const isFirstRun = !this.hasStartedRun
    this.hasStartedRun = true
    this.run = isFirstRun
      ? { startAt: 0, appShellReadyAt: this.appShellReadyAt, connectedAt: now }
      : { startAt: this.pendingRequestAt ?? now }
    this.pendingRequestAt = undefined
  }

  /**
   * Called when the run's PageProfile message is handled. Returns the run's
   * milestones, or undefined if no run has started since the last call.
   */
  public scriptFinished(): RunMilestones | undefined {
    const { run } = this
    if (!run) return undefined
    this.run = undefined

    const toRunTime = (time: number): number => Math.round(time - run.startAt)
    return {
      ...(run.appShellReadyAt !== undefined && {
        appShellReadyMs: toRunTime(run.appShellReadyAt),
      }),
      ...(run.connectedAt !== undefined && {
        connectedMs: toRunTime(run.connectedAt),
      }),
      scriptFinishedMs: toRunTime(this.now()),
    }
  }
}
