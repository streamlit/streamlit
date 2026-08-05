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

import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"

import {
  StyledSkillsInstallCallout,
  StyledSkillsInstallCalloutButton,
  StyledSkillsInstallCalloutIcon,
  StyledSkillsInstallCalloutText,
} from "./styled-components"

type InstallStatus = "idle" | "installing" | "success" | "error"

/** How long the success confirmation lingers before the callout auto-dismisses. */
const SUCCESS_AUTO_DISMISS_MS = 2500

export interface SkillsInstallCalloutProps {
  /**
   * Whether the callout is still eligible to show. When it flips false while the
   * callout is still idle — the mutually exclusive toast appeared, the server
   * stopped recommending, or skills were installed (elsewhere, or by a rerun
   * that remounted this box mid-install) — the callout hides itself so it can't
   * linger with a stale CTA or coexist with the toast. It only HIDES (it doesn't
   * permanently dismiss), so if eligibility returns (e.g. the toast is closed)
   * the callout reappears. A callout that is installing / succeeded / errored
   * ignores this and finishes its transaction.
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
 * A single "Install Streamlit skills" call-to-action shown inside an error box
 * during local development. It only renders when the server has detected an AI
 * coding agent that lacks Streamlit's skills, so the copy speaks to that agent:
 * a one-click way to give it version-matched Streamlit knowledge at the moment
 * a developer hits an error.
 *
 * It deliberately reads as one more line on the error — it sits inside the error
 * box and inherits its tint and text color, with a small sparkle accent and an
 * underlined text action — rather than a dominant panel, so it coexists with the
 * existing Copy / Ask links instead of overpowering them.
 *
 * Not dismissable by the user (no ✕ / snooze / "don't show again"): it clears
 * on a successful install (after a brief confirmation) or when the parent stops
 * recommending it. On failure it offers a "Retry", mirroring the nudge toast.
 */
function SkillsInstallCallout({
  enabled,
  onInstall,
  onShown,
  onDismiss,
}: Readonly<SkillsInstallCalloutProps>): ReactElement | null {
  const theme = useEmotionTheme()
  const [status, setStatus] = useState<InstallStatus>("idle")
  const [errorMessage, setErrorMessage] = useState("")

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

  const handleInstall = useCallback(() => {
    setStatus("installing")
    setErrorMessage("")
    onInstall()
      .then(() => {
        setStatus("success")
      })
      .catch((error: unknown) => {
        setStatus("error")
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to install skills."
        )
      })
  }, [onInstall])

  const isInstalling = status === "installing"
  const isSuccess = status === "success"
  const isError = status === "error"

  const iconValue = isSuccess
    ? ":material/check_circle:"
    : isError
      ? ":material/error:"
      : ":material/auto_awesome:"
  // Idle/installing/error share the error box's text color so the callout
  // blends into the box; success flips to green to signal the install landed.
  const iconColor = isSuccess
    ? theme.colors.greenColor
    : theme.colors.redTextColor

  const message = isSuccess
    ? "Skills installed — your AI assistant is ready to help."
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
    <StyledSkillsInstallCallout
      data-testid="stSkillsInstallCallout"
      className="stSkillsInstallCallout"
      role="status"
      aria-live="polite"
    >
      <StyledSkillsInstallCalloutIcon aria-hidden="true">
        <DynamicIcon iconValue={iconValue} size="base" color={iconColor} />
      </StyledSkillsInstallCalloutIcon>
      <StyledSkillsInstallCalloutText $success={isSuccess}>
        {message}
      </StyledSkillsInstallCalloutText>
      {!isSuccess && (
        <StyledSkillsInstallCalloutButton
          onClick={handleInstall}
          disabled={isInstalling}
        >
          {isInstalling ? "Installing…" : isError ? "Retry" : "Install skills"}
        </StyledSkillsInstallCalloutButton>
      )}
    </StyledSkillsInstallCallout>
  )
}

export default memo(SkillsInstallCallout)
