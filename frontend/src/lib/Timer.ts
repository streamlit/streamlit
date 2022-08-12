/**
 * A wrapper around setTimeout that adds some useful features, like getting the
 * remaining time.
 */
export class Timer {
  private timerHandle?: number

  private duration = 0

  private startTime = 0

  private running = false

  /** True if the timer is currently running */
  public get isRunning(): boolean {
    return this.running
  }

  /** Remaining time before timeout, or 0 if the timer is not running */
  public get remainingTime(): number {
    if (!this.running) {
      return 0
    }
    const elapsed = Date.now() - this.startTime
    return Math.max(this.duration - elapsed, 0)
  }

  /**
   * Starts the Timer with the given callback.
   * If the Timer is already running, it will be canceled first.
   */
  public setTimeout(handler: () => void, time: number): void {
    this.cancel()
    this.startTime = Date.now()
    this.duration = time
    this.running = true
    this.timerHandle = window.setTimeout(() => {
      this.running = false
      handler()
    }, time)
  }

  /** Cancels the Timer. If the Timer is not already running, this is a no-op. */
  public cancel(): void {
    if (this.timerHandle !== undefined) {
      window.clearTimeout(this.timerHandle)
      this.timerHandle = undefined
      this.running = false
    }
  }
}
