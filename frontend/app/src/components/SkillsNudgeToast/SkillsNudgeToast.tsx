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

import { ReactElement, useCallback, useEffect, useState } from "react"

import {
  BaseButton,
  BaseButtonKind,
  BaseButtonSize,
  DynamicIcon,
  useEmotionTheme,
} from "@streamlit/lib"

import {
  StyledSkillsNudgeActions,
  StyledSkillsNudgeBody,
  StyledSkillsNudgeClose,
  StyledSkillsNudgeContent,
  StyledSkillsNudgeError,
  StyledSkillsNudgeHeading,
  StyledSkillsNudgeIcon,
  StyledSkillsNudgeLink,
  StyledSkillsNudgeToast,
} from "./styled-components"

/** How long the success confirmation stays visible before auto-dismissing. */
const SUCCESS_AUTO_DISMISS_MS = 3000

type NudgeStatus = "idle" | "installing" | "success" | "error"

export interface SkillsNudgeToastProps {
  /**
   * Perform the one-click install. Resolves on success and rejects with an
   * Error (carrying a user-facing message) on failure.
   */
  onInstall: () => Promise<void>
  /** Close (✕): snooze the nudge (reappears on a later server start). */
  onSnooze: () => void
  /** Permanently dismiss the nudge (localStorage + server-side marker). */
  onDontShowAgain: () => void
  /** Hide the nudge (used to auto-dismiss after a successful install). */
  onDismiss: () => void
}

/**
 * An app-level toast shown by Streamlit during local development that offers a
 * one-click install of the bundled agent skills. This is distinct from the
 * app-author `st.toast` API: it is injected by the framework, not the script,
 * and mirrors the native toast's look and feel.
 */
function SkillsNudgeToast({
  onInstall,
  onSnooze,
  onDontShowAgain,
  onDismiss,
}: Readonly<SkillsNudgeToastProps>): ReactElement {
  const theme = useEmotionTheme()
  const [status, setStatus] = useState<NudgeStatus>("idle")
  const [errorMessage, setErrorMessage] = useState("")

  const handleInstall = useCallback(() => {
    setStatus("installing")
    setErrorMessage("")
    onInstall()
      .then(() => setStatus("success"))
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
    const timeoutId = setTimeout(onDismiss, SUCCESS_AUTO_DISMISS_MS)
    return () => clearTimeout(timeoutId)
  }, [status, onDismiss])

  const isInstalling = status === "installing"
  const isSuccess = status === "success"
  const isError = status === "error"

  return (
    <StyledSkillsNudgeToast
      className="stSkillsNudge"
      data-testid="stSkillsNudge"
      role="status"
      aria-live="polite"
    >
      <StyledSkillsNudgeIcon>
        <DynamicIcon
          iconValue={
            isSuccess ? ":material/check_circle:" : ":material/auto_awesome:"
          }
          size="lg"
          color={isSuccess ? theme.colors.greenColor : theme.colors.primary}
        />
      </StyledSkillsNudgeIcon>

      <StyledSkillsNudgeContent>
        {isSuccess ? (
          <StyledSkillsNudgeHeading>Skills installed</StyledSkillsNudgeHeading>
        ) : (
          <>
            <StyledSkillsNudgeHeading>
              Help agents write better Streamlit apps
            </StyledSkillsNudgeHeading>
            <StyledSkillsNudgeBody>
              Install the official Streamlit skills so AI coding assistants can
              build and debug your app.
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
                onClick={onDontShowAgain}
                disabled={isInstalling}
              >
                Don't show again
              </StyledSkillsNudgeLink>
            </StyledSkillsNudgeActions>
          </>
        )}
      </StyledSkillsNudgeContent>

      {!isSuccess && (
        <StyledSkillsNudgeClose
          type="button"
          aria-label="Dismiss"
          onClick={onSnooze}
          disabled={isInstalling}
        >
          <DynamicIcon iconValue=":material/close:" size="base" />
        </StyledSkillsNudgeClose>
      )}
    </StyledSkillsNudgeToast>
  )
}

export default SkillsNudgeToast
