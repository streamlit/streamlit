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

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

/**
 * SkillsInstallContext lets the lib-level error display (ExceptionElement) offer
 * a one-click "install Streamlit skills" call-to-action, without the lib
 * depending on app-level concerns. The app (which owns the backend operation
 * client and the server's recommendation flag) supplies the values; the lib
 * only consumes them. This mirrors how `LibConfigContext` feeds `showErrorLinks`
 * into `ExceptionElement`.
 *
 * The callout is a single Install CTA — there is no dismiss/snooze on this
 * surface. It is suppressed by `enabled` going false (after install, or after
 * the server stops recommending skills, e.g. once they're installed or the
 * user permanently dismissed the separate nudge toast).
 *
 * Consumed by:
 * @see ExceptionElement
 */
export interface SkillsInstallContextProps {
  /**
   * Whether the install callout is allowed to show. The app computes this from
   * the server's recommendation flag plus localhost/embed gating; the lib adds
   * its own per-error gate (errors only, links enabled).
   */
  enabled: boolean

  /**
   * Perform the one-click install. Resolves with an optional detail message
   * (e.g. where the skills were installed) on success, and rejects with an
   * Error (carrying a user-facing message) on failure. The app routes the
   * install-funnel telemetry (with the "errorCallout" surface) through here.
   */
  onInstall: () => Promise<string | undefined>

  /**
   * Record that the callout was shown (the impression event, tagged with the
   * "errorCallout" surface). Called once when the callout first appears.
   */
  onShown: () => void

  /**
   * Claim the single callout slot for `token`. Returns true if `token` now owns
   * the slot (or already did). Used to guarantee that at most one callout shows
   * even when several error boxes are on screen.
   */
  claimCallout: (token: symbol) => boolean

  /** Release the callout slot if `token` currently owns it. */
  releaseCallout: (token: symbol) => void
}

const noop = (): void => {}
const noopInstall = (): Promise<string | undefined> =>
  Promise.resolve(undefined)

/**
 * Inert defaults so the lib renders in isolation (tests, Storybook) and so the
 * callout never shows unless an app explicitly provides a value. The default
 * `claimCallout` returns false, so without a provider no callout is rendered.
 */
export const SkillsInstallContext = createContext<SkillsInstallContextProps>({
  enabled: false,
  onInstall: noopInstall,
  onShown: noop,
  claimCallout: () => false,
  releaseCallout: noop,
})

SkillsInstallContext.displayName = "SkillsInstallContext"

/**
 * Claim the single shared callout slot the first time this error box becomes
 * `eligible`. Returns whether this caller owns the slot and should render the
 * callout.
 *
 * The claim is "sticky": once acquired it is kept even if `eligible` later flips
 * false (e.g. a successful install turns the server recommendation off, or the
 * proactive toast appears) — so the callout can finish showing its success
 * confirmation instead of being yanked mid-frame. The slot is freed only when
 * the owning error box unmounts.
 *
 * Idempotent under React StrictMode's mount/unmount/mount double-invoke because
 * the per-instance token re-acquires its own slot. Hand-off note: if the owner
 * unmounts without a rerun, a sibling does not auto-take-over until the next
 * rerun remounts the tree — acceptable, as exception elements are script-output
 * driven and remount on rerun.
 */
export function useSkillsCalloutSlot(eligible: boolean): boolean {
  const { claimCallout, releaseCallout } = useContext(SkillsInstallContext)
  const tokenRef = useRef<symbol | null>(null)
  if (tokenRef.current === null) {
    tokenRef.current = Symbol("skillsCalloutSlot")
  }
  const [ownsSlot, setOwnsSlot] = useState(false)

  // Claim once, when first eligible. Skip while not eligible or already owning,
  // so an `eligible` flip to false never releases the slot here.
  useLayoutEffect(() => {
    if (!eligible || ownsSlot) {
      return
    }
    if (claimCallout(tokenRef.current as symbol)) {
      setOwnsSlot(true)
    }
  }, [eligible, ownsSlot, claimCallout])

  // Free the slot only on unmount.
  useEffect(() => {
    const token = tokenRef.current as symbol
    return () => releaseCallout(token)
  }, [releaseCallout])

  return ownsSlot
}
