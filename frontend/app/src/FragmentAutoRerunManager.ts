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

type AutoRerunTimer = ReturnType<typeof setInterval>

interface FragmentAutoRerunManagerProps {
  /** Called whenever a fragment's managed `run_every` timer fires. */
  onTick: (fragmentId: string) => void
}

/**
 * Owns the `run_every` timers for fragment-scoped auto-reruns.
 *
 * Each fragment can have at most one active timer. Callers can also prune
 * timers after a render-tree update so stale fragments stop scheduling reruns
 * once they disappear from the committed app state.
 */
export class FragmentAutoRerunManager {
  private readonly timers = new Map<string, AutoRerunTimer>()

  private readonly onTick: (fragmentId: string) => void

  public constructor({ onTick }: FragmentAutoRerunManagerProps) {
    this.onTick = onTick
  }

  /**
   * Start or replace the auto-rerun timer for a fragment.
   *
   * Re-registering the same fragment clears its previous interval first so only
   * the latest server configuration stays active.
   */
  public schedule(fragmentId: string, intervalSeconds: number): void {
    this.clear(fragmentId)

    this.timers.set(
      fragmentId,
      setInterval(() => {
        this.onTick(fragmentId)
      }, intervalSeconds * 1000)
    )
  }

  /** Stop the auto-rerun timer for a single fragment, if one exists. */
  public clear(fragmentId: string): void {
    const timer = this.timers.get(fragmentId)

    if (timer === undefined) {
      return
    }

    clearInterval(timer)
    this.timers.delete(fragmentId)
  }

  /** Stop every managed auto-rerun timer. */
  public clearAll(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer)
    }
    this.timers.clear()
  }

  /**
   * Remove timers for fragments that are no longer present in the committed tree.
   */
  public pruneInactive(activeFragmentIds: ReadonlySet<string>): void {
    for (const fragmentId of Array.from(this.timers.keys())) {
      if (!activeFragmentIds.has(fragmentId)) {
        this.clear(fragmentId)
      }
    }
  }

  /** Return whether any fragment-scoped auto-rerun timers are still active. */
  public hasActiveAutoReruns(): boolean {
    return this.timers.size > 0
  }
}
