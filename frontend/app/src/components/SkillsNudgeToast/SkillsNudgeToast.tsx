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

import { ReactElement, useCallback, useEffect, useRef, useState } from "react"

import { type QueuedToast } from "react-aria-components/Toast"

import {
  BaseButton,
  BaseButtonKind,
  BaseButtonSize,
  DynamicIcon,
  StyledMessageWrapper,
  StyledToast,
  StyledToastWrapper,
  type ToastContent,
  useEmotionTheme,
} from "@streamlit/lib"

import {
  StyledSkillsNudgeActions,
  StyledSkillsNudgeBody,
  StyledSkillsNudgeClose,
  StyledSkillsNudgeError,
  StyledSkillsNudgeHeading,
  StyledSkillsNudgeLink,
} from "./styled-components"

/** How long the success confirmation stays visible before auto-dismissing. */
const SUCCESS_AUTO_DISMISS_MS = 3000

type NudgeStatus = "idle" | "installing" | "success" | "error"

export interface SkillsNudgeToastProps {
  /** The queued toast this nudge renders into (provides the react-aria shell). */
  toast: QueuedToast<ToastContent>
  /** Dismiss this toast from the shared queue. */
  close: () => void
  /**
   * Perform the one-click install. Resolves with an optional detail message
   * (e.g. where the skills were installed) on success, and rejects with an
   * Error (carrying a user-facing message) on failure.
   */
  onInstall: () => Promise<string | undefined>
  /** Close (✕): snooze the nudge (reappears on a later server start). */
  onSnooze: () => void
  /** Permanently dismiss the nudge (localStorage + server-side marker). */
  onDontShowAgain: () => void
}

/**
 * The framework "install skills" nudge, rendered into the shared toast region
 * (the same react-aria queue/shell that backs ``st.toast``) so it inherits the
 * native toast's positioning, elevation, animation, and accessibility. This is
 * distinct from the app-author ``st.toast`` API: it is injected by Streamlit,
 * not the script, and offers a one-click install of the bundled agent skills.
 */
function SkillsNudgeToast({
  toast,
  close,
  onInstall,
  onSnooze,
  onDontShowAgain,
}: Readonly<SkillsNudgeToastProps>): ReactElement {
  const theme = useEmotionTheme()
  const [status, setStatus] = useState<NudgeStatus>("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [successDetail, setSuccessDetail] = useState("")

  // The toast region hands us a fresh `close` on every render; keep the latest
  // in a ref so the success auto-dismiss timer below isn't reset each render.
  const closeRef = useRef(close)
  closeRef.current = close

  const handleInstall = useCallback(() => {
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
  }, [onInstall])

  // Auto-dismiss shortly after a successful install so the confirmation is
  // visible but the toast does not linger.
  useEffect(() => {
    if (status !== "success") {
      return undefined
    }
    // eslint-disable-next-line no-restricted-globals -- Timed auto-dismiss of a transient confirmation.
    const timeoutId = setTimeout(
      () => closeRef.current(),
      SUCCESS_AUTO_DISMISS_MS
    )
    return () => clearTimeout(timeoutId)
  }, [status])

  const handleSnooze = useCallback(() => {
    onSnooze()
    close()
  }, [onSnooze, close])

  const handleDontShowAgain = useCallback(() => {
    onDontShowAgain()
    close()
  }, [onDontShowAgain, close])

  const isInstalling = status === "installing"
  const isSuccess = status === "success"
  const isError = status === "error"

  return (
    <StyledToast
      toast={toast}
      data-testid="stSkillsNudge"
      className="stSkillsNudge"
    >
      <StyledToastWrapper>
        <DynamicIcon
          iconValue={
            isSuccess ? ":material/check_circle:" : ":material/auto_awesome:"
          }
          size="lg"
          color={isSuccess ? theme.colors.greenColor : theme.colors.primary}
        />
        <StyledMessageWrapper>
          {isSuccess ? (
            <>
              <StyledSkillsNudgeHeading>
                Skills installed
              </StyledSkillsNudgeHeading>
              {successDetail && (
                <StyledSkillsNudgeBody>{successDetail}</StyledSkillsNudgeBody>
              )}
            </>
          ) : (
            <>
              <StyledSkillsNudgeHeading>
                Help agents write better Streamlit apps
              </StyledSkillsNudgeHeading>
              <StyledSkillsNudgeBody>
                Install the official Streamlit skills so AI coding assistants
                can build and debug your app.
              </StyledSkillsNudgeBody>

              {isError && (
                <StyledSkillsNudgeError>{errorMessage}</StyledSkillsNudgeError>
              )}

              <StyledSkillsNudgeActions>
                <BaseButton
                  kind={BaseButtonKind.PRIMARY}
                  size={BaseButtonSize.SMALL}
                  onClick={handleInstall}
                  disabled={isInstalling}
                >
                  {isInstalling ? "Installing…" : "Install"}
                </BaseButton>
                <StyledSkillsNudgeLink
                  type="button"
                  onClick={handleDontShowAgain}
                  disabled={isInstalling}
                >
                  Don't show again
                </StyledSkillsNudgeLink>
              </StyledSkillsNudgeActions>
            </>
          )}
        </StyledMessageWrapper>
      </StyledToastWrapper>

      {!isSuccess && (
        <StyledSkillsNudgeClose
          type="button"
          aria-label="Dismiss"
          onClick={handleSnooze}
          disabled={isInstalling}
        >
          <DynamicIcon iconValue=":material/close:" size="base" />
        </StyledSkillsNudgeClose>
      )}
    </StyledToast>
  )
}

export default SkillsNudgeToast
