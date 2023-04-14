/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import { EmotionIcon } from "@emotion-icons/emotion-icon"
import { Ellipses, Info, Warning } from "@emotion-icons/open-iconic"
import { withTheme } from "@emotion/react"
import { RERUN_PROMPT_MODAL_DIALOG } from "src/lib/baseconsts"
import React, { PureComponent, ReactNode } from "react"
import { HotKeys } from "react-hotkeys"
import { CSSTransition } from "react-transition-group"
import Button, { Kind } from "src/components/shared/Button"
import Tooltip, { Placement } from "src/components/shared/Tooltip"
import { SignalConnection } from "typed-signals"

import { ConnectionState } from "src/app/connection/ConnectionState"
import { SessionEvent } from "src/autogen/proto"
import { SessionEventDispatcher } from "src/app/SessionEventDispatcher"
import { ScriptRunState } from "src/lib/ScriptRunState"
import { Timer } from "src/lib/util/Timer"
import Icon from "src/components/shared/Icon"
import { EmotionTheme } from "src/theme"

/*
 * IMPORTANT: If you change the asset import below, make sure it still works if Streamlit is served
 * from a subpath.
 */
import iconRunning from "src/assets/img/icon_running.gif"
import newYearsRunning from "src/assets/img/fireworks.gif"

import {
  StyledConnectionStatus,
  StyledConnectionStatusLabel,
  StyledAppStatus,
  StyledAppButtonContainer,
  StyledAppRunningIcon,
  StyledAppStatusLabel,
  StyledShortcutLabel,
  StyledStatusWidget,
} from "./styled-components"

/** Component props */
export interface StatusWidgetProps {
  /** State of our connection to the server. */
  connectionState: ConnectionState

  /** Dispatches transient SessionEvents received from the server. */
  sessionEventDispatcher: SessionEventDispatcher

  /** script's current runstate */
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

  theme: EmotionTheme
}

/** Component state */
interface State {
  /**
   * True if our AppStatus or ConnectionStatus should be minimized.
   * Does not affect AppStatus prompts.
   */
  statusMinimized: boolean

  /**
   * If true, the server has told us that a script has changed and is
   * not being automatically re-run; we'll prompt the user to manually
   * re-run when this happens.
   *
   * This is reverted to false in getDerivedStateFromProps when the script
   * begins running again.
   */
  scriptChangedOnDisk: boolean

  /** True if our Script Changed prompt should be minimized. */
  promptMinimized: boolean

  /**
   * True if our Script Changed prompt is being hovered. Hovered prompts are always
   * shown, even if they'd otherwise be minimized.
   */
  promptHovered: boolean
}

interface ConnectionStateUI {
  icon: EmotionIcon
  label: string
  tooltip: string
}

// Amount of time to display the "Script Changed. Rerun?" prompt when it first appears.
const PROMPT_DISPLAY_INITIAL_TIMEOUT_MS = 15 * 1000

// Amount of time to display the Script Changed prompt after the user has hovered
// and then unhovered on it.
const PROMPT_DISPLAY_HOVER_TIMEOUT_MS = 1.0 * 1000

/**
 * Displays various script- and connection-related info: our WebSocket
 * connection status, the run-state of our script, and other transient events.
 */
class StatusWidget extends PureComponent<StatusWidgetProps, State> {
  /** onSessionEvent signal connection */
  private sessionEventConn?: SignalConnection

  private curView?: ReactNode

  private readonly minimizePromptTimer = new Timer()

  private readonly keyHandlers: {
    [key: string]: (keyEvent?: KeyboardEvent) => void
  }

  constructor(props: StatusWidgetProps) {
    super(props)

    this.state = {
      statusMinimized: StatusWidget.shouldMinimize(),
      promptMinimized: false,
      scriptChangedOnDisk: false,
      promptHovered: false,
    }

    this.keyHandlers = {
      a: this.handleAlwaysRerunClick,
      // No handler for 'r' since it's handled by app.jsx and precedence
      // isn't working when multiple components handle the same key
      // 'r': this.handleRerunClick,
    }
  }

  /** Called by React on prop changes */
  public static getDerivedStateFromProps(
    props: Readonly<StatusWidgetProps>
  ): Partial<State> | null {
    // Reset transient event-related state when prop changes
    // render that state irrelevant
    if (props.scriptRunState === ScriptRunState.RUNNING) {
      return { scriptChangedOnDisk: false, promptHovered: false }
    }

    return null
  }

  public componentDidMount(): void {
    this.sessionEventConn =
      this.props.sessionEventDispatcher.onSessionEvent.connect(e =>
        this.handleSessionEvent(e)
      )
    window.addEventListener("scroll", this.handleScroll)
  }

  public componentWillUnmount(): void {
    if (this.sessionEventConn !== undefined) {
      this.sessionEventConn.disconnect()
      this.sessionEventConn = undefined
    }

    this.minimizePromptTimer.cancel()

    window.removeEventListener("scroll", this.handleScroll)
  }

  private isConnected(): boolean {
    return this.props.connectionState === ConnectionState.CONNECTED
  }

  private handleSessionEvent(event: SessionEvent): void {
    if (event.type === "scriptChangedOnDisk") {
      this.setState({ scriptChangedOnDisk: true, promptMinimized: false })
      this.minimizePromptAfterTimeout(PROMPT_DISPLAY_INITIAL_TIMEOUT_MS)
    }
  }

  private minimizePromptAfterTimeout(timeout: number): void {
    // Don't cut an existing timer short. If our timer is already
    // running, and is due to expire later than the new timeout
    // value, leave the timer alone.
    if (timeout > this.minimizePromptTimer.remainingTime) {
      this.minimizePromptTimer.setTimeout(() => {
        this.setState({ promptMinimized: true })
      }, timeout)
    }
  }

  private static shouldMinimize(): boolean {
    return window.scrollY > 32
  }

  private handleScroll = (): void => {
    this.setState({
      statusMinimized: StatusWidget.shouldMinimize(),
    })
  }

  public render(): ReactNode {
    // The StatusWidget fades in on appear and fades out on disappear.
    // We keep track of our most recent result from `renderWidget`,
    // via `this.curView`, so that we can fade out our previous state
    // if `renderWidget` returns null after returning a non-null value.

    const prevView = this.curView
    this.curView = this.renderWidget()
    if (prevView == null && this.curView == null) {
      return null
    }

    let animateIn: boolean
    let renderView: ReactNode
    if (this.curView != null) {
      animateIn = true
      renderView = this.curView
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
        <StyledStatusWidget key="StatusWidget" data-testid="stStatusWidget">
          {renderView}
        </StyledStatusWidget>
      </CSSTransition>
    )
  }

  private renderWidget(): ReactNode {
    if (this.isConnected()) {
      if (
        this.props.scriptRunState === ScriptRunState.RUNNING ||
        this.props.scriptRunState === ScriptRunState.RERUN_REQUESTED
      ) {
        // Show scriptIsRunning when the script is actually running,
        // but also when the user has just requested a re-run.
        // In the latter case, the server should get around to actually
        // re-running the script in a second or two, but we can appear
        // more responsive by claiming it's started immemdiately.
        return this.renderScriptIsRunning()
      }
      if (!RERUN_PROMPT_MODAL_DIALOG && this.state.scriptChangedOnDisk) {
        return this.renderRerunScriptPrompt()
      }
    }

    return this.renderConnectionStatus()
  }

  /** E.g. "Disconnected [Icon]" */
  private renderConnectionStatus(): ReactNode {
    const ui = StatusWidget.getConnectionStateUI(this.props.connectionState)
    if (ui === undefined) {
      return null
    }

    return (
      <Tooltip content={ui.tooltip} placement={Placement.BOTTOM}>
        <StyledConnectionStatus data-testid="stConnectionStatus">
          <Icon size="sm" content={ui.icon} />
          <StyledConnectionStatusLabel
            isMinimized={this.state.statusMinimized}
          >
            {ui.label}
          </StyledConnectionStatusLabel>
        </StyledConnectionStatus>
      </Tooltip>
    )
  }

  private static isNewYears(): boolean {
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

  /** "Running... [Stop]" */
  private renderScriptIsRunning(): ReactNode {
    const minimized = this.state.statusMinimized
    const stopRequested =
      this.props.scriptRunState === ScriptRunState.STOP_REQUESTED
    const stopButton = StatusWidget.promptButton(
      stopRequested ? "Stopping..." : "Stop",
      stopRequested,
      this.handleStopScriptClick,
      minimized
    )

    // check if current date between 12/31 and 1/06 to render correct gif
    const isNewYears = StatusWidget.isNewYears()
    const runningSrc = isNewYears ? newYearsRunning : iconRunning
    const runningIcon = (
      <StyledAppRunningIcon
        isNewYears={isNewYears}
        src={runningSrc}
        alt="Running..."
      />
    )

    return (
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
        <StyledAppStatusLabel
          isMinimized={this.state.statusMinimized}
          isPrompt={false}
        >
          Running...
        </StyledAppStatusLabel>
        {stopButton}
      </StyledAppStatus>
    )
  }

  /**
   * "Source file changed. [Rerun] [Always Rerun]"
   * (This is only shown when the RERUN_PROMPT_MODAL_DIALOG feature flag is false)
   */
  private renderRerunScriptPrompt(): ReactNode {
    const rerunRequested =
      this.props.scriptRunState === ScriptRunState.RERUN_REQUESTED
    const minimized = this.state.promptMinimized && !this.state.promptHovered
    const { colors } = this.props.theme

    // Not sure exactly why attach and focused are necessary on the
    // HotKeys component here but its not working without them
    return (
      <HotKeys handlers={this.keyHandlers} attach={window} focused={true}>
        <div
          onMouseEnter={this.onAppPromptHover}
          onMouseLeave={this.onAppPromptUnhover}
        >
          <StyledAppStatus>
            <Icon content={Info} margin="0 sm 0 0" color={colors.bodyText} />
            <StyledAppStatusLabel isMinimized={minimized} isPrompt>
              Source file changed.
            </StyledAppStatusLabel>

            {StatusWidget.promptButton(
              <StyledShortcutLabel>Rerun</StyledShortcutLabel>,
              rerunRequested,
              this.handleRerunClick,
              minimized
            )}

            {this.props.allowRunOnSave &&
              StatusWidget.promptButton(
                <StyledShortcutLabel>Always rerun</StyledShortcutLabel>,
                rerunRequested,
                this.handleAlwaysRerunClick,
                minimized
              )}
          </StyledAppStatus>
        </div>
      </HotKeys>
    )
  }

  private onAppPromptHover = (): void => {
    this.setState({ promptHovered: true })
  }

  private onAppPromptUnhover = (): void => {
    this.setState({ promptHovered: false, promptMinimized: false })
    this.minimizePromptAfterTimeout(PROMPT_DISPLAY_HOVER_TIMEOUT_MS)
  }

  private handleStopScriptClick = (): void => {
    this.props.stopScript()
  }

  private handleRerunClick = (): void => {
    this.props.rerunScript(false)
  }

  private handleAlwaysRerunClick = (): void => {
    if (this.props.allowRunOnSave) {
      this.props.rerunScript(true)
    }
  }

  private static promptButton(
    title: ReactNode,
    disabled: boolean,
    onClick: () => void,
    isMinimized: boolean
  ): ReactNode {
    return (
      <StyledAppButtonContainer isMinimized={isMinimized}>
        <Button
          kind={Kind.HEADER_BUTTON}
          disabled={disabled}
          fluidWidth
          onClick={onClick}
        >
          {title}
        </Button>
      </StyledAppButtonContainer>
    )
  }

  private static getConnectionStateUI(
    state: ConnectionState
  ): ConnectionStateUI | undefined {
    switch (state) {
      case ConnectionState.INITIAL:
      case ConnectionState.PINGING_SERVER:
      case ConnectionState.CONNECTING:
        return {
          icon: Ellipses,
          label: "Connecting",
          tooltip: "Connecting to Streamlit server",
        }

      case ConnectionState.CONNECTED:
        return undefined

      case ConnectionState.DISCONNECTED_FOREVER:
      default:
        return {
          icon: Warning,
          label: "Error",
          tooltip: "Unable to connect to Streamlit server",
        }
    }
  }
}

export default withTheme(StatusWidget)
