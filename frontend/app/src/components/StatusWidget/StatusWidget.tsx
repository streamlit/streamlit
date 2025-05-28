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

import { Info } from "@emotion-icons/open-iconic"
import { useTheme } from "@emotion/react"
import Hotkeys from "react-hot-keys"
import { CSSTransition } from "react-transition-group"
import { SignalConnection } from "typed-signals"

import {
  BaseButton,
  BaseButtonKind,
  Icon,
  Placement,
  ScriptRunState,
  Timer,
  Tooltip,
} from "@streamlit/lib"
import { SessionEvent } from "@streamlit/protobuf"
import { isNullOrUndefined, notNullOrUndefined } from "@streamlit/utils"
import iconRunning from "@streamlit/app/src/assets/img/icon_running.gif"
import newYearsRunning from "@streamlit/app/src/assets/img/fireworks.gif"
import { ConnectionState } from "@streamlit/connection"
import { SessionEventDispatcher } from "@streamlit/app/src/SessionEventDispatcher"

import {
  StyledAppButtonContainer,
  StyledAppRunningIcon,
  StyledAppStatus,
  StyledAppStatusLabel,
  StyledConnectionStatus,
  StyledConnectionStatusLabel,
  StyledShortcutLabel,
  StyledStatusWidget,
} from "./styled-components"
import { getConnectionStateUI } from "./getConnectionStateUI"

/** Component props */
export interface StatusWidgetProps {
  /** State of our connection to the server. */
  connectionState: ConnectionState

  /** Dispatches transient SessionEvents received from the server. */
  sessionEventDispatcher: SessionEventDispatcher

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
}

// Amount of time to display the "Script Changed. Rerun?" prompt when it first appears.
const PROMPT_DISPLAY_INITIAL_TIMEOUT_MS = 15 * 1000

// Amount of time to display the Script Changed prompt after the user has hovered
// and then unhovered on it.
const PROMPT_DISPLAY_HOVER_TIMEOUT_MS = 1.0 * 1000

// Delay time for displaying running man animation.
const RUNNING_MAN_DISPLAY_DELAY_TIME_MS = 500

interface PromptButtonProps {
  title: ReactNode
  disabled: boolean
  onClick: () => void
  isMinimized: boolean
}

const PromptButton = (props: PromptButtonProps): ReactElement => {
  return (
    <StyledAppButtonContainer isMinimized={props.isMinimized}>
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
  sessionEventDispatcher,
  scriptRunState,
  rerunScript,
  stopScript,
  allowRunOnSave,
}) => {
  const shouldMinimize = useCallback((): boolean => {
    return window.scrollY > 32
  }, [])
  const [statusMinimized, setStatusMinimized] = useState(shouldMinimize)
  const [scriptChangedOnDisk, setScriptChangedOnDisk] = useState(false)
  const [promptMinimized, setPromptMinimized] = useState(false)
  const [promptHovered, setPromptHovered] = useState(false)
  const [showRunningMan, setShowRunningMan] = useState(false)
  const minimizePromptTimer: React.MutableRefObject<Timer | null> =
    useRef(null)
  const delayShowRunningManTimer: React.MutableRefObject<Timer | null> =
    useRef(null)
  const sessionEventConn = useRef<SignalConnection>()
  const theme = useTheme()

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

  const minimizePromptAfterTimeout = useCallback((timeout: number): void => {
    // Don't cut an existing timer short. If our timer is already
    // running, and is due to expire later than the new timeout
    // value, leave the timer alone.
    if (minimizePromptTimer.current !== null) {
      if (timeout > minimizePromptTimer.current.remainingTime) {
        minimizePromptTimer.current.setTimeout(() => {
          setPromptMinimized(true)
        }, timeout)
      }
    }
  }, [])

  const handleSessionEvent = useCallback(
    (event: SessionEvent): void => {
      if (event.type === "scriptChangedOnDisk") {
        setScriptChangedOnDisk(true)
        setPromptMinimized(false)
        minimizePromptAfterTimeout(PROMPT_DISPLAY_INITIAL_TIMEOUT_MS)
      }
    },
    [minimizePromptAfterTimeout]
  )

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

  const handleScroll = useCallback((): void => {
    setStatusMinimized(shouldMinimize())
  }, [shouldMinimize])

  const onAppPromptHover = (): void => {
    setPromptHovered(true)
  }

  const onAppPromptUnhover = (): void => {
    setPromptHovered(false)
    setPromptMinimized(false)
    minimizePromptAfterTimeout(PROMPT_DISPLAY_HOVER_TIMEOUT_MS)
  }

  const handleStopScriptClick = (): void => {
    stopScript()
  }

  const handleRerunClick = (): void => {
    rerunScript(false)
  }

  const isNewYears = (): boolean => {
    // Test if current date between 12/31 & 1/06
    const currentDate = new Date()
    const month = currentDate.getMonth()
    const date = currentDate.getDate()
    // Check if Dec 31st
    if (month === 11 && date === 31) return true
    // Check if Jan 1st through 6th
    if (month === 0 && date <= 6) return true
    return false
  }

  useEffect(() => {
    sessionEventConn.current =
      sessionEventDispatcher.onSessionEvent.connect(handleSessionEvent)
    return () => {
      if (sessionEventConn.current !== undefined) {
        sessionEventConn.current.disconnect()
        sessionEventConn.current = undefined
      }
    }
  }, [handleSessionEvent, sessionEventDispatcher.onSessionEvent])

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
    window.addEventListener("scroll", handleScroll)
    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [handleScroll])

  useEffect(() => {
    if (scriptRunState === ScriptRunState.RUNNING) {
      setScriptChangedOnDisk(false)

      setPromptHovered(false)
    }
  }, [scriptRunState])

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
    const minimized = statusMinimized
    const stopRequested = scriptRunState === ScriptRunState.STOP_REQUESTED
    const isNewYear = isNewYears()
    const runningSrc = isNewYear ? newYearsRunning : iconRunning
    const runningIcon = (
      <StyledAppRunningIcon
        isNewYears={isNewYear}
        src={runningSrc}
        alt="Running..."
      />
    )
    return showRunningMan ? (
      <StyledAppStatus>
        {minimized ? (
          <Tooltip
            placement={Placement.BOTTOM}
            content="This script is currently running"
          >
            {runningIcon}
          </Tooltip>
        ) : (
          runningIcon
        )}
        <StyledAppStatusLabel isMinimized={statusMinimized} isPrompt={false}>
          Running...
        </StyledAppStatusLabel>
        <PromptButton
          isMinimized={statusMinimized}
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
    const minimized = promptMinimized && !promptHovered
    const { colors } = theme
    return (
      <Hotkeys keyName="a" onKeyDown={handleKeyDown}>
        <div onMouseEnter={onAppPromptHover} onMouseLeave={onAppPromptUnhover}>
          <StyledAppStatus>
            <Icon content={Info} margin="0 sm 0 0" color={colors.bodyText} />
            <StyledAppStatusLabel isMinimized={minimized} isPrompt>
              Source file changed.
            </StyledAppStatusLabel>
            <PromptButton
              isMinimized={minimized}
              title={<StyledShortcutLabel>Rerun</StyledShortcutLabel>}
              disabled={rerunRequested}
              onClick={handleRerunClick}
            />
            {allowRunOnSave && (
              <PromptButton
                isMinimized={minimized}
                title={<StyledShortcutLabel>Always rerun</StyledShortcutLabel>}
                disabled={rerunRequested}
                onClick={handleAlwaysRerunClick}
              />
            )}
          </StyledAppStatus>
        </div>
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
          <StyledConnectionStatusLabel isMinimized={statusMinimized}>
            {ui.label}
          </StyledConnectionStatusLabel>
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
      if (scriptChangedOnDisk) {
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
