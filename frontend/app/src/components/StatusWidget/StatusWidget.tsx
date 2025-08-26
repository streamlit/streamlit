/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
import React, {
  ReactElement,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import Hotkeys from "react-hot-keys"
import { CSSTransition } from "react-transition-group"

import { ConnectionState } from "@streamlit/connection"
import {
  BaseButton,
  BaseButtonKind,
  DynamicIcon,
  Icon,
  Placement,
  ScriptRunState,
  Timer,
  Tooltip,
  useEmotionTheme,
} from "@streamlit/lib"
import { isNullOrUndefined, notNullOrUndefined } from "@streamlit/utils"

import { getConnectionStateUI } from "./getConnectionStateUI"
import IconRunning from "./IconRunning"
import {
  StyledAppButtonContainer,
  StyledAppStatus,
  StyledAppStatusLabel,
  StyledConnectionStatus,
  StyledConnectionStatusLabel,
  StyledShortcutLabel,
  StyledStatusWidget,
} from "./styled-components"

/** Component props */
export interface StatusWidgetProps {
  /** State of our connection to the server. */
  connectionState: ConnectionState

  /** Script's current run state */
  scriptRunState: ScriptRunState

  /**
   * Function called when the user chooses to re-run a script in response to
   * its source file changing.
   *
   * @param alwaysRerun if true, also change the run-on-save setting for this
   * session
   */
  rerunScript: (alwaysRerun: boolean) => void

  /** Function called when the user chooses to stop the running script. */
  stopScript: () => void

  /** Allows users to change user settings to allow rerun on save */
  allowRunOnSave: boolean

  /** Whether to show script changed actions (rerun/always rerun buttons) */
  showScriptChangedActions: boolean
}

// Delay time for displaying running man animation.
const RUNNING_MAN_DISPLAY_DELAY_TIME_MS = 500

interface PromptButtonProps {
  title: ReactNode
  disabled: boolean
  onClick: () => void
}

const PromptButton = (props: PromptButtonProps): ReactElement => {
  return (
    <StyledAppButtonContainer>
      <BaseButton
        kind={BaseButtonKind.HEADER_BUTTON}
        disabled={props.disabled}
        containerWidth
        onClick={props.onClick}
      >
        {props.title}
      </BaseButton>
    </StyledAppButtonContainer>
  )
}

/**
 * Displays various script- and connection-related info: our WebSocket
 * connection status, the run-state of our script, and other transient events.
 */
const StatusWidget: React.FC<StatusWidgetProps> = ({
  connectionState,
  scriptRunState,
  rerunScript,
  stopScript,
  allowRunOnSave,
  showScriptChangedActions,
}) => {
  const [showRunningMan, setShowRunningMan] = useState(false)
  const minimizePromptTimer: React.MutableRefObject<Timer | null> =
    useRef(null)
  const delayShowRunningManTimer: React.MutableRefObject<Timer | null> =
    useRef(null)
  const theme = useEmotionTheme()

  const handleAlwaysRerunClick = (): void => {
    if (allowRunOnSave) {
      rerunScript(true)
    }
  }

  const handleKeyDown = (keyName: string): void => {
    // NOTE: 'r' is handled at the App Level
    if (keyName === "a") {
      handleAlwaysRerunClick()
    }
  }

  const isConnected = connectionState === ConnectionState.CONNECTED

  const showRunningManAfterInitialDelay = useCallback(
    (delay: number): void => {
      if (delayShowRunningManTimer.current !== null) {
        delayShowRunningManTimer.current.setTimeout(() => {
          setShowRunningMan(true)
        }, delay)
      }
    },
    []
  )

  const handleStopScriptClick = (): void => {
    stopScript()
  }

  const handleRerunClick = (): void => {
    rerunScript(false)
  }

  useEffect(() => {
    if (minimizePromptTimer.current === null) {
      minimizePromptTimer.current = new Timer()
    }
    if (delayShowRunningManTimer.current === null) {
      delayShowRunningManTimer.current = new Timer()
    }

    const minimizePromptTimerCurr = minimizePromptTimer.current
    const delayShowRunningManTimerCurr = minimizePromptTimer.current

    return () => {
      minimizePromptTimerCurr.cancel()
      delayShowRunningManTimerCurr.cancel()
    }
  }, [])

  useEffect(() => {
    if (isConnected) {
      if (
        scriptRunState === ScriptRunState.RUNNING ||
        scriptRunState === ScriptRunState.RERUN_REQUESTED
      ) {
        showRunningManAfterInitialDelay(RUNNING_MAN_DISPLAY_DELAY_TIME_MS)
      }
    }
    if (scriptRunState === ScriptRunState.NOT_RUNNING) {
      setShowRunningMan(false)
    }
  }, [scriptRunState, showRunningManAfterInitialDelay, isConnected])

  const renderScriptIsRunning = (): ReactNode => {
    const stopRequested = scriptRunState === ScriptRunState.STOP_REQUESTED

    return showRunningMan ? (
      <StyledAppStatus>
        <IconRunning />
        <PromptButton
          title={stopRequested ? "Stopping..." : "Stop"}
          disabled={stopRequested}
          onClick={handleStopScriptClick}
        />
      </StyledAppStatus>
    ) : (
      <></>
    )
  }

  const renderRerunScriptPrompt = (): ReactNode => {
    const rerunRequested = scriptRunState === ScriptRunState.RERUN_REQUESTED
    return (
      <Hotkeys keyName="a" onKeyDown={handleKeyDown}>
        <StyledAppStatus>
          <DynamicIcon
            size="lg"
            iconValue={":material/info:"}
            color={theme.colors.fadedText60}
          />
          <StyledAppStatusLabel isPrompt>File change.</StyledAppStatusLabel>
          <PromptButton
            title={<StyledShortcutLabel>Rerun</StyledShortcutLabel>}
            disabled={rerunRequested}
            onClick={handleRerunClick}
          />
          {allowRunOnSave && (
            <PromptButton
              title={<StyledShortcutLabel>Always rerun</StyledShortcutLabel>}
              disabled={rerunRequested}
              onClick={handleAlwaysRerunClick}
            />
          )}
        </StyledAppStatus>
      </Hotkeys>
    )
  }

  const renderConnectionStatus = (): ReactNode => {
    const ui = getConnectionStateUI(connectionState)
    if (ui === undefined) {
      return null
    }
    return (
      <Tooltip content={ui.tooltip} placement={Placement.BOTTOM}>
        <StyledConnectionStatus
          className="stConnectionStatus"
          data-testid="stConnectionStatus"
        >
          <Icon size="sm" content={ui.icon} />
          <StyledConnectionStatusLabel>{ui.label}</StyledConnectionStatusLabel>
        </StyledConnectionStatus>
      </Tooltip>
    )
  }

  const renderWidget = (): ReactNode => {
    if (isConnected) {
      if (
        scriptRunState === ScriptRunState.RUNNING ||
        scriptRunState === ScriptRunState.RERUN_REQUESTED
      ) {
        // Show scriptIsRunning when the script is actually running,
        // but also when the user has just requested a re-run.
        // In the latter case, the server should get around to actually
        // re-running the script in a second or two, but we can appear
        // more responsive by claiming it's started immediately.
        return renderScriptIsRunning()
      }
      if (showScriptChangedActions) {
        return renderRerunScriptPrompt()
      }
    }

    return renderConnectionStatus()
  }

  // The StatusWidget fades in on appear and fades out on disappear.
  // We keep track of our most recent result from `renderWidget`,
  // via `this.curView`, so that we can fade out our previous state
  // if `renderWidget` returns null after returning a non-null value.
  const curView = useRef<ReactNode>()
  const prevView = curView.current
  curView.current = renderWidget()

  if (isNullOrUndefined(curView.current) && isNullOrUndefined(prevView)) {
    return <></>
  }

  let animateIn: boolean
  let renderView: ReactNode
  if (notNullOrUndefined(curView.current)) {
    animateIn = true
    renderView = curView.current
  } else {
    animateIn = false
    renderView = prevView
  }

  // NB: the `timeout` value here must match the transition
  // times specified in the StatusWidget-*-active CSS classes
  return (
    <CSSTransition
      appear={true}
      in={animateIn}
      timeout={200}
      unmountOnExit={true}
      classNames="StatusWidget"
    >
      <StyledStatusWidget
        key="StatusWidget"
        className="stStatusWidget"
        data-testid="stStatusWidget"
      >
        {renderView}
      </StyledStatusWidget>
    </CSSTransition>
  )
}

export default StatusWidget
