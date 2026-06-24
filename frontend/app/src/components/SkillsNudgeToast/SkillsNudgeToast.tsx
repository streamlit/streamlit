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
  KeyboardEvent,
  ReactElement,
  useCallback,
  useEffect,
  useState,
} from "react"

import {
  BaseButton,
  BaseButtonKind,
  BaseButtonSize,
  DynamicIcon,
  StyledMessageWrapper,
  StyledToastWrapper,
  useEmotionTheme,
} from "@streamlit/lib"

import {
  StyledSkillsNudgeActions,
  StyledSkillsNudgeBody,
  StyledSkillsNudgeCard,
  StyledSkillsNudgeClose,
  StyledSkillsNudgeHeading,
  StyledSkillsNudgeLink,
} from "./styled-components"

/** How long the success confirmation stays visible before auto-dismissing. */
const SUCCESS_AUTO_DISMISS_MS = 3000

type NudgeStatus = "idle" | "installing" | "success" | "error"

export interface SkillsNudgeToastProps {
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
  /**
   * Remove the nudge from view. Called after snooze / don't-show-again and by
   * the success auto-dismiss. The owner (App) controls visibility, so this
   * just hides the card; it does not itself persist any preference.
   */
  onClose: () => void
}

/**
 * The framework "install skills" nudge: a standalone, persistent call-to-action
 * card (distinct from the app-author ``st.toast`` API) that offers a one-click
 * install of the bundled agent skills. It shares the toast surface's look (via
 * ``getToastCardStyle``) but is intentionally NOT a queued toast: it must
 * outrank and outlive transient app toasts and stay put until the developer
 * acts on it, so it is pinned above the toast region rather than competing
 * inside the queue.
 */
function SkillsNudgeToast({
  onInstall,
  onSnooze,
  onDontShowAgain,
  onClose,
}: Readonly<SkillsNudgeToastProps>): ReactElement {
  const theme = useEmotionTheme()
  const [status, setStatus] = useState<NudgeStatus>("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [successDetail, setSuccessDetail] = useState("")

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
  // visible but the card does not linger. Idle/error states never auto-dismiss
  // (the nudge persists until the developer acts on it). `onClose` is a stable
  // bound handler from App, so this effect re-runs only on a status change.
  useEffect(() => {
    if (status !== "success") {
      return undefined
    }
    // eslint-disable-next-line no-restricted-globals -- Timed auto-dismiss of a transient confirmation.
    const timeoutId = setTimeout(onClose, SUCCESS_AUTO_DISMISS_MS)
    return () => clearTimeout(timeoutId)
  }, [status, onClose])

  const handleSnooze = useCallback(() => {
    onSnooze()
    onClose()
  }, [onSnooze, onClose])

  const handleDontShowAgain = useCallback(() => {
    onDontShowAgain()
    onClose()
  }, [onDontShowAgain, onClose])

  const isInstalling = status === "installing"
  const isSuccess = status === "success"
  const isError = status === "error"

  // Escape dismisses the card (snooze), mirroring the ✕ — restores the
  // keyboard-dismiss affordance the react-aria toast region used to provide for
  // this content. Bubbles from the focused buttons inside the card. Ignored
  // mid-install so an in-flight request isn't abandoned by a stray keypress.
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape" && !isInstalling && !isSuccess) {
        event.stopPropagation()
        handleSnooze()
      }
    },
    [handleSnooze, isInstalling, isSuccess]
  )

  return (
    <StyledSkillsNudgeCard
      data-testid="stSkillsNudge"
      className="stSkillsNudge"
      role="status"
      aria-live="polite"
      onKeyDown={handleKeyDown}
    >
      <StyledToastWrapper>
        <DynamicIcon
          iconValue={
            isSuccess
              ? ":material/check_circle:"
              : isError
                ? ":material/error:"
                : ":material/auto_awesome:"
          }
          size="lg"
          color={
            isSuccess
              ? theme.colors.greenColor
              : isError
                ? theme.colors.redTextColor
                : theme.colors.primary
          }
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
            // Idle, installing, and error share one layout (heading + body +
            // actions). Error is a distinct *follow-up* state — not the offer
            // with an error wedged in: the pitch is replaced by the failure
            // reason and the primary action becomes "Retry", mirroring how
            // success replaces the whole card.
            <>
              <StyledSkillsNudgeHeading>
                {isError
                  ? "Couldn't install skills"
                  : "Help agents write better Streamlit"}
              </StyledSkillsNudgeHeading>
              <StyledSkillsNudgeBody>
                {isError
                  ? errorMessage
                  : "Install the official Streamlit skills so AI coding agents can build and debug your apps."}
              </StyledSkillsNudgeBody>

              <StyledSkillsNudgeActions>
                <BaseButton
                  kind={BaseButtonKind.PRIMARY}
                  size={BaseButtonSize.SMALL}
                  onClick={handleInstall}
                  disabled={isInstalling}
                >
                  {isInstalling
                    ? "Installing…"
                    : isError
                      ? "Retry"
                      : "Install"}
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
          aria-label="Close"
          onClick={handleSnooze}
          disabled={isInstalling}
        >
          <DynamicIcon iconValue=":material/close:" size="base" />
        </StyledSkillsNudgeClose>
      )}
    </StyledSkillsNudgeCard>
  )
}

export default SkillsNudgeToast
