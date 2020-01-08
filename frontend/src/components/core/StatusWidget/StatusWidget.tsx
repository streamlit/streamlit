/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { RERUN_PROMPT_MODAL_DIALOG } from "lib/baseconsts"
import React, { PureComponent, ReactNode } from "react"
import { HotKeys } from "react-hotkeys"
import { CSSTransition } from "react-transition-group"
import { Button, UncontrolledTooltip } from "reactstrap"
import { SignalConnection } from "typed-signals"

import { ConnectionState } from "lib/ConnectionState"
import { SessionEvent } from "autogen/proto"
import { SessionEventDispatcher } from "lib/SessionEventDispatcher"
import { ReportRunState } from "lib/ReportRunState"
import { Timer } from "lib/Timer"
import Icon from "components/shared/Icon"
import iconRunning from "assets/img/icon_running.gif"
import "./StatusWidget.scss"

/** Component props */
interface Props {
  /** State of our connection to the server. */
  connectionState: ConnectionState

  /** Dispatches transient SessionEvents received from the server. */
  sessionEventDispatcher: SessionEventDispatcher

  /** Report's current runstate */
  reportRunState: ReportRunState

  /**
   * Function called when the user chooses to re-run the report
   * in response to its source file changing.
   * @param alwaysRerun if true, also change the run-on-save setting for this report
   */
  rerunReport: (alwaysRerun: boolean) => void

  /** Function called when the user chooses to stop the running report. */
  stopReport: () => void
}

/** Component state */
interface State {
  /**
   * True if our ReportStatus or ConnectionStatus should be minimized.
   * Does not affect ReportStatus prompts.
   */
  statusMinimized: boolean

  /**
   * If true, the server has told us that the report has changed and is
   * not being automatically re-run; we'll prompt the user to manually
   * re-run when this happens.
   *
   * This is reverted to false in getDerivedStateFromProps when the report
   * begins running again.
   */
  reportChangedOnDisk: boolean

  /** True if our Report Changed prompt should be minimized. */
  promptMinimized: boolean

  /**
   * True if our Report Changed prompt is being hovered. Hovered prompts are always
   * shown, even if they'd otherwise be minimized.
   */
  promptHovered: boolean
}

interface ConnectionStateUI {
  icon: string
  label: string
  tooltip: string
}

// Amount of time to display the "Report Changed. Rerun?" prompt when it first appears.
const PROMPT_DISPLAY_INITIAL_TIMEOUT_MS = 15 * 1000

// Amount of time to display the Report Changed prompt after the user has hovered
// and then unhovered on it.
const PROMPT_DISPLAY_HOVER_TIMEOUT_MS = 1.0 * 1000

/**
 * Displays various report- and connection-related info: our WebSocket
 * connection status, the run-state of our report, and transient report-related
 * events.
 */
export class StatusWidget extends PureComponent<Props, State> {
  /** onSessionEvent signal connection */
  private sessionEventConn?: SignalConnection
  private curView?: ReactNode

  private readonly minimizePromptTimer = new Timer()
  private readonly keyHandlers: {
    [key: string]: (keyEvent?: KeyboardEvent) => void
  }

  constructor(props: Props) {
    super(props)

    this.state = {
      statusMinimized: StatusWidget.shouldMinimize(),
      promptMinimized: false,
      reportChangedOnDisk: false,
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
  public static getDerivedStateFromProps(props: Props): Partial<State> | null {
    // Reset transient event-related state when prop changes
    // render that state irrelevant
    if (props.reportRunState === ReportRunState.RUNNING) {
      return { reportChangedOnDisk: false, promptHovered: false }
    }

    return null
  }

  public componentDidMount(): void {
    this.sessionEventConn = this.props.sessionEventDispatcher.onSessionEvent.connect(
      e => this.handleSessionEvent(e)
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
    if (event.type === "reportChangedOnDisk") {
      this.setState({ reportChangedOnDisk: true, promptMinimized: false })
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
        <div key="StatusWidget">{renderView}</div>
      </CSSTransition>
    )
  }

  private renderWidget(): ReactNode {
    if (this.isConnected()) {
      if (
        this.props.reportRunState === ReportRunState.RUNNING ||
        this.props.reportRunState === ReportRunState.RERUN_REQUESTED
      ) {
        // Show reportIsRunning when the report is actually running,
        // but also when the user has just requested a re-run.
        // In the latter case, the server should get around to actually
        // re-running the report in a second or two, but we can appear
        // more responsive by claiming it's started immemdiately.
        return this.renderReportIsRunning()
      } else if (
        !RERUN_PROMPT_MODAL_DIALOG &&
        this.state.reportChangedOnDisk
      ) {
        return this.renderRerunReportPrompt()
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
      <div>
        <div
          id="ConnectionStatus"
          className={this.state.statusMinimized ? "minimized" : ""}
        >
          <Icon className="icon" type={ui.icon} />
          <label>{ui.label}</label>
        </div>
        <UncontrolledTooltip placement="bottom" target="ConnectionStatus">
          {ui.tooltip}
        </UncontrolledTooltip>
      </div>
    )
  }

  /** "Running... [Stop]" */
  private renderReportIsRunning(): ReactNode {
    const stopRequested =
      this.props.reportRunState === ReportRunState.STOP_REQUESTED
    const stopButton = StatusWidget.promptButton(
      stopRequested ? "Stopping..." : "Stop",
      stopRequested,
      this.handleStopReportClick
    )

    return (
      <div
        id="ReportStatus"
        className={
          this.state.statusMinimized ? "report-is-running-minimized" : ""
        }
      >
        <img
          className="ReportRunningIcon"
          src={iconRunning}
          alt="Running..."
        />
        <label>Running...</label>
        {stopButton}
        {this.state.statusMinimized ? (
          <UncontrolledTooltip placement="bottom" target="ReportStatus">
            This script is currently running
          </UncontrolledTooltip>
        ) : (
          ""
        )}
      </div>
    )
  }

  /**
   * "Source file changed. [Rerun] [Always Rerun]"
   * (This is only shown when the RERUN_PROMPT_MODAL_DIALOG feature flag is false)
   */
  private renderRerunReportPrompt(): ReactNode {
    const rerunRequested =
      this.props.reportRunState === ReportRunState.RERUN_REQUESTED
    const minimized = this.state.promptMinimized && !this.state.promptHovered

    // Not sure exactly why attach and focused are necessary on the
    // HotKeys component here but its not working without them
    return (
      <HotKeys handlers={this.keyHandlers} attach={window} focused={true}>
        <div
          onMouseEnter={this.onReportPromptHover}
          onMouseLeave={this.onReportPromptUnhover}
        >
          <div
            id="ReportStatus"
            className={minimized ? "rerun-prompt-minimized" : ""}
          >
            <Icon className="icon" type="info" />
            <label className="prompt">Source file changed.</label>

            {StatusWidget.promptButton(
              <div className="underlineFirstLetter">Rerun</div>,
              rerunRequested,
              this.handleRerunClick
            )}

            {StatusWidget.promptButton(
              <div className="underlineFirstLetter">Always rerun</div>,
              rerunRequested,
              this.handleAlwaysRerunClick
            )}
          </div>
        </div>
      </HotKeys>
    )
  }

  private onReportPromptHover = (): void => {
    this.setState({ promptHovered: true })
  }

  private onReportPromptUnhover = (): void => {
    this.setState({ promptHovered: false, promptMinimized: false })
    this.minimizePromptAfterTimeout(PROMPT_DISPLAY_HOVER_TIMEOUT_MS)
  }

  private handleStopReportClick = (): void => {
    this.props.stopReport()
  }

  private handleRerunClick = (): void => {
    this.props.rerunReport(false)
  }

  private handleAlwaysRerunClick = (): void => {
    this.props.rerunReport(true)
  }

  private static promptButton(
    title: ReactNode,
    disabled: boolean,
    onClick: () => void
  ): ReactNode {
    return (
      <Button
        outline
        size="sm"
        color="info"
        disabled={disabled}
        onClick={onClick}
      >
        <div>{title}</div>
      </Button>
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
          icon: "ellipses",
          label: "Connecting",
          tooltip: "Connecting to Streamlit server",
        }

      case ConnectionState.CONNECTED:
      case ConnectionState.STATIC:
        return undefined

      case ConnectionState.DISCONNECTED_FOREVER:
      default:
        return {
          icon: "warning",
          label: "Error",
          tooltip: "Unable to connect to Streamlit server",
        }
    }
  }
}
