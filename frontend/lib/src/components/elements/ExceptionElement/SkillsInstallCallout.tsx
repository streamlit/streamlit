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
  memo,
  ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { Kind } from "~lib/components/shared/AlertContainer/AlertContainer"
import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"

import {
  StyledSkillsInstallCallout,
  StyledSkillsInstallCalloutButton,
  StyledSkillsInstallCalloutIcon,
  StyledSkillsInstallCalloutText,
} from "./styled-components"

type InstallStatus = "idle" | "installing" | "success" | "error"

/**
 * How long the success confirmation lingers before the callout auto-dismisses.
 * Matches the nudge toast's confirmation so the same message doesn't get less
 * reading time on one surface than the other.
 */
const SUCCESS_AUTO_DISMISS_MS = 3000

export interface SkillsInstallCalloutProps {
  /**
   * Whether the callout is still eligible to show. When it flips false while the
   * callout is still idle — the mutually exclusive toast appeared, the server
   * stopped recommending, or skills were installed (elsewhere, or by a rerun
   * that remounted this box mid-install) — the callout hides itself so it can't
   * linger with a stale CTA or coexist with the toast. It only HIDES (it doesn't
   * permanently dismiss), so if eligibility returns (e.g. the toast is closed)
   * the callout reappears.
   *
   * A callout that is installing or confirming ignores this and finishes. So does
   * one showing a failure — an error report isn't a transaction that ends, so it
   * stays until its error box unmounts. That would be the one way the two surfaces
   * could coexist, which is why the app also stops re-raising the toast once an
   * install has failed this session.
   */
  enabled: boolean
  /**
   * Perform the one-click install. Resolves with an optional detail message on
   * success, rejects with an Error (user-facing message) on failure.
   */
  onInstall: () => Promise<string | undefined>
  /** Record the impression. Called once when the callout first appears. */
  onShown: () => void
  /**
   * Remove the callout from view. Called once the success confirmation has been
   * shown briefly; the parent owns mounting, so this just hides it.
   */
  onDismiss: () => void
}

/**
 * A single "Install Streamlit skills" call-to-action shown below an error box
 * during local development. It only renders when the server has detected an AI
 * coding agent that lacks Streamlit's skills, so the copy speaks to that agent:
 * a one-click way to give it version-matched Streamlit knowledge at the moment
 * a developer hits an error.
 *
 * It sits in its own box directly under the error, sharing the error's tint,
 * corner radius, and padding, so it reads as an attached follow-on to that error
 * rather than a dominant panel or an unrelated block. The action is a text link,
 * matching the error's own Copy / Ask links.
 *
 * Not dismissable by the user (no ✕ / snooze / "don't show again"): it clears
 * on a successful install (after a brief confirmation) or when the parent stops
 * recommending it. On failure it offers a "Retry", mirroring the nudge toast.
 *
 * Its arrival is deliberately not announced: the copy is a polite live region,
 * and a live region inserted with its content already in place doesn't fire, so
 * an unsolicited CTA never interrupts a screen reader user mid-sentence. They
 * reach it in linear reading and in the tab order; only the transitions they
 * themselves trigger are announced.
 */
function SkillsInstallCallout({
  enabled,
  onInstall,
  onShown,
  onDismiss,
}: Readonly<SkillsInstallCalloutProps>): ReactElement | null {
  const [status, setStatus] = useState<InstallStatus>("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [successDetail, setSuccessDetail] = useState("")

  // Fire the impression exactly once when the callout mounts (it only mounts
  // when it's actually shown). Guarded so a re-render can't double-count.
  const shownRef = useRef(false)
  useEffect(() => {
    if (!shownRef.current) {
      shownRef.current = true
      onShown()
    }
  }, [onShown])

  // After a successful install, show the confirmation briefly, then ask the
  // parent to remove the callout. Mirrors the nudge toast's success dismiss.
  useEffect(() => {
    if (status !== "success") {
      return undefined
    }
    // eslint-disable-next-line no-restricted-globals -- Timed auto-dismiss of a transient confirmation.
    const timeoutId = setTimeout(onDismiss, SUCCESS_AUTO_DISMISS_MS)
    return () => clearTimeout(timeoutId)
  }, [status, onDismiss])

  const isInstalling = status === "installing"
  const isSuccess = status === "success"
  const isError = status === "error"

  const handleInstall = useCallback(() => {
    // The button reports unavailability via aria-disabled rather than the
    // disabled attribute (which would blur it mid-interaction), so it stays
    // clickable and has to reject a second click itself.
    if (isInstalling) {
      return
    }
    setStatus("installing")
    setErrorMessage("")
    onInstall()
      .then(detail => {
        setSuccessDetail(detail ?? "")
        setStatus("success")
      })
      .catch((error: unknown) => {
        setStatus("error")
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to install skills."
        )
      })
  }, [isInstalling, onInstall])

  const iconValue = isSuccess
    ? ":material/check_circle:"
    : isError
      ? ":material/error:"
      : ":material/auto_awesome:"

  // The installing state gets its own sentence rather than reusing the idle
  // pitch: it's the only thing that tells a screen reader user the click landed,
  // since the live region is scoped to this copy and so no longer re-reads the
  // button's label.
  const message = isSuccess
    ? // Prefer the server's detail — it reports WHERE skills landed and, more
      // importantly, names any skill it had to skip. A partial install must not
      // be confirmed as an unqualified success.
      successDetail || "Skills installed — your AI assistant is ready to help."
    : isInstalling
      ? "Installing Streamlit’s skills…"
      : isError
        ? `Couldn’t install skills. ${errorMessage}`
        : "Install Streamlit’s skills so your AI assistant can fix errors like this."

  // Hide (don't permanently dismiss) an idle callout while it isn't eligible —
  // the mutually exclusive toast is up, the server stopped recommending, or
  // skills were installed. The slot stays claimed, so if eligibility returns
  // (e.g. the toast is closed) the callout reappears on the same error box. A
  // callout that is installing or showing a success/error confirmation
  // (status !== "idle") is never hidden mid-transaction.
  if (status === "idle" && !enabled) {
    return null
  }

  return (
    // The box takes the error tint while there's still something to act on, and
    // flips to the success tint once the install lands — so a confirmation never
    // reads as green text sitting in a red error box. The icon and copy inherit
    // that colour, so the kind is the only thing that needs to change.
    <StyledSkillsInstallCallout
      $kind={isSuccess ? Kind.SUCCESS : Kind.ERROR}
      data-testid="stSkillsInstallCallout"
      className="stSkillsInstallCallout"
    >
      <StyledSkillsInstallCalloutIcon aria-hidden="true">
        <DynamicIcon iconValue={iconValue} size="base" />
      </StyledSkillsInstallCalloutIcon>
      {/* The live region is the copy alone, not the whole box. `role="status"`
          implies aria-atomic, so including the button would re-announce the
          entire pitch on every label change. */}
      <StyledSkillsInstallCalloutText role="status">
        {message}
      </StyledSkillsInstallCalloutText>
      {!isSuccess && (
        <StyledSkillsInstallCalloutButton
          onClick={handleInstall}
          aria-disabled={isInstalling || undefined}
        >
          {isInstalling ? "Installing…" : isError ? "Retry" : "Install skills"}
        </StyledSkillsInstallCalloutButton>
      )}
    </StyledSkillsInstallCallout>
  )
}

export default memo(SkillsInstallCallout)
