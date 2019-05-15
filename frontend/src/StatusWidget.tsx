/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 *
 * @fileoverview Displays various report- and connection-related
 * info: our WebSocket connection status, the run-state of our
 * report, and transient report-related events.
 */

/** Feature flag for showing the "Stop Script" button */
const SHOW_STOP_BUTTON = false;

import React, {PureComponent, ReactNode} from 'react';
import {CSSTransition} from 'react-transition-group';
import {Button, UncontrolledTooltip} from 'reactstrap';
import {SignalConnection} from 'typed-signals';

import {ConnectionState} from './ConnectionState';
import {SessionEvent} from './protobuf';
import {SessionEventDispatcher} from './SessionEventDispatcher';
import {ReportRunState} from './ReportRunState';
import {Timer} from './Timer';
import './StatusWidget.scss';

/** Component props */
interface Props {
  /** State of our connection to the proxy. */
  connectionState: ConnectionState;

  /** Dispatches transient SessionEvents received from the proxy. */
  sessionEventDispatcher: SessionEventDispatcher;

  /** Report's current runstate */
  reportRunState: ReportRunState;

  /**
   * Function called when the user chooses to re-run the report
   * in response to its source file changing.
   * @param alwaysRerun if true, also change the run-on-save setting for this report
   */
  rerunReport: (alwaysRerun: boolean) => void;

  /** Function called when the user chooses to stop the running report. */
  stopReport: () => void;
}

/** Component state */
interface State {
  /**
   * True if our ReportStatus or ConnectionStatus should be minimized.
   * Does not affect ReportStatus prompts.
   */
  statusMinimized: boolean;

  /**
   * If true, the server has told us that the report has changed and is
   * not being automatically re-run; we'll prompt the user to manually
   * re-run when this happens.
   *
   * This is reverted to false in getDerivedStateFromProps when the report
   * begins running again.
   */
  reportChangedOnDisk: boolean;

  /** True if our Report Changed prompt should be minimized. */
  promptMinimized: boolean;

  /**
   * True if our Report Changed prompt is being hovered. Hovered prompts are always
   * shown, even if they'd otherwise be minimized.
   */
  promptHovered: boolean;
}

interface ConnectionStateUI {
  icon: ReactNode;
  label: string;
  tooltip: string;
}

// Amount of time to display the "Report Changed. Rerun?" prompt when it first appears.
const PROMPT_DISPLAY_INITIAL_TIMEOUT_MS = 15 * 1000;

// Amount of time to display the Report Changed prompt after the user has hovered
// and then unhovered on it.
const PROMPT_DISPLAY_HOVER_TIMEOUT_MS = 1.0 * 1000;

export class StatusWidget extends PureComponent<Props, State> {
  /** onSessionEvent signal connection */
  private sessionEventConn?: SignalConnection;
  private curView?: ReactNode;

  private readonly minimizePromptTimer = new Timer();

  public constructor(props: Props) {
    super(props);

    this.state = {
      statusMinimized: StatusWidget.shouldMinimize(),
      promptMinimized: false,
      reportChangedOnDisk: false,
      promptHovered: false,
    };
  }

  /** Called by React on prop changes */
  public static getDerivedStateFromProps(props: Props): Partial<State> | null {
    // Reset transient event-related state when prop changes
    // render that state irrelevant
    if (props.reportRunState === ReportRunState.RUNNING) {
      return {reportChangedOnDisk: false, promptHovered: false};
    }

    return null;
  }

  public componentDidMount(): void {
    this.sessionEventConn = this.props.sessionEventDispatcher.onSessionEvent.connect(
      evt => this.handleSessionEvent(evt));
    window.addEventListener('scroll', this.handleScroll);
  }

  public componentWillUnmount(): void {
    if (this.sessionEventConn !== undefined) {
      this.sessionEventConn.disconnect();
      this.sessionEventConn = undefined;
    }

    this.minimizePromptTimer.cancel();

    window.removeEventListener('scroll', this.handleScroll);
  }

  /**
   * Called by StreamlitApp when the 'a' hotkey is pressed.
   * This simulates a click on the "Always Rerun" button, if that
   * button is showing.
   */
  public handleAlwaysRerunHotkeyPressed = (): void => {
    if (this.state.reportChangedOnDisk) {
      this.handleAlwaysRerunClick();
    }
  };

  private isConnected(): boolean {
    return this.props.connectionState === ConnectionState.CONNECTED;
  }

  private handleSessionEvent(event: SessionEvent): void {
    switch (event.type) {
      case 'reportChangedOnDisk':
        this.setState({reportChangedOnDisk: true, promptMinimized: false});
        this.minimizePromptAfterTimeout(PROMPT_DISPLAY_INITIAL_TIMEOUT_MS);
        break;

      default:
        console.warn(`Unhandled SessionEvent: ${event}`);
        break;
    }
  }

  private minimizePromptAfterTimeout(timeout: number): void {
    // Don't cut an existing timer short. If our timer is already
    // running, and is due to expire later than the new timeout
    // value, leave the timer alone.
    if (timeout > this.minimizePromptTimer.remainingTime) {
      this.minimizePromptTimer.setTimeout(() => {
        this.setState({promptMinimized: true});
      }, timeout);
    }
  }

  private static shouldMinimize(): boolean {
    return window.scrollY > 32;
  }

  private handleScroll = (): void => {
    this.setState({
      statusMinimized: StatusWidget.shouldMinimize(),
    });
  };

  public render(): ReactNode {
    // The StatusWidget fades in on appear and fades out on disappear.
    // We keep track of our most recent result from `renderWidget`,
    // via `this.curView`, so that we can fade out our previous state
    // if `renderWidget` returns null after returning a non-null value.

    const prevView = this.curView;
    this.curView = this.renderWidget();
    if (prevView == null && this.curView == null) {
      return null;
    }

    let animateIn: boolean;
    let renderView: ReactNode;
    if (this.curView != null) {
      animateIn = true;
      renderView = this.curView;
    } else {
      animateIn = false;
      renderView = prevView;
    }

    // NB: the `timeout` value here must match the transition
    // times specified in the StatusWidget-*-active CSS classes
    return (
      <CSSTransition
        appear={true}
        in={animateIn}
        timeout={200}
        unmountOnExit={true}
        classNames="StatusWidget">
        <div key="StatusWidget">{renderView}</div>
      </CSSTransition>
    );
  }

  private renderWidget(): ReactNode {
    if (this.isConnected()) {
      if (this.props.reportRunState === ReportRunState.RUNNING ||
        this.props.reportRunState === ReportRunState.RERUN_REQUESTED) {

        // Show reportIsRunning when the report is actually running,
        // but also when the user has just requested a re-run.
        // In the latter case, the server should get around to actually
        // re-running the report in a second or two, but we can appear
        // more responsive by claiming it's started immemdiately.
        return this.renderReportIsRunning();
      } else if (this.state.reportChangedOnDisk) {
        return this.renderRerunReportPrompt();
      }
    }

    return this.renderConnectionStatus();
  }

  /** E.g. "Disconnected [Icon]" */
  private renderConnectionStatus(): ReactNode {
    const ui = StatusWidget.getConnectionStateUI(this.props.connectionState);
    if (ui === undefined) {
      return null;
    }

    return (
      <div>
        <div
          id="ConnectionStatus"
          className={this.state.statusMinimized ? 'minimized' : ''}>
          <svg className="icon" viewBox="0 0 8 8">
            {ui.icon}
          </svg>
          <label>
            {ui.label}
          </label>
        </div>
        <UncontrolledTooltip placement="bottom" target="ConnectionStatus">
          {ui.tooltip}
        </UncontrolledTooltip>
      </div>
    );
  }

  /** "Running... [Stop]" */
  private renderReportIsRunning(): ReactNode {
    let stopButton: ReactNode = null;
    if (SHOW_STOP_BUTTON) {
      const stopRequested = this.props.reportRunState === ReportRunState.STOP_REQUESTED;
      stopButton = StatusWidget.promptButton(
        stopRequested ? 'Stopping...' : 'Stop',
        stopRequested,
        this.handleStopReportClick);
    }

    return (
      <div
        id="ReportStatus"
        className={this.state.statusMinimized ? 'minimized' : ''}>
        <img className="ReportRunningIcon" src="./icon_running.gif" alt=""/>
        <label>
          Running...
        </label>
        {stopButton}

        {
          this.state.statusMinimized ?
            <UncontrolledTooltip placement="bottom" target="ReportStatus">
              This script is currently running
            </UncontrolledTooltip> :
            ''
        }
      </div>
    );
  }

  /** "Source file changed. [Rerun] [Always Rerun]" */
  private renderRerunReportPrompt(): ReactNode {
    const rerunRequested = this.props.reportRunState === ReportRunState.RERUN_REQUESTED;
    const minimized = this.state.promptMinimized && !this.state.promptHovered;

    return (
      <div
        onMouseEnter={this.onReportPromptHover}
        onMouseLeave={this.onReportPromptUnhover}>
        <div
          id="ReportStatus"
          className={minimized ? 'minimized' : ''}>
          <svg className="icon" viewBox="0 0 8 8">
            <use xlinkHref="./open-iconic.min.svg#info"/>
          </svg>

          <label className="prompt">
            Source file changed.
          </label>

          {StatusWidget.promptButton(
            <div className="UnderlineFirstLetter">Rerun</div>,
            rerunRequested,
            this.handleRerunClick
          )}

          {StatusWidget.promptButton(
            <div className="UnderlineFirstLetter">Always rerun</div>,
            rerunRequested,
            this.handleAlwaysRerunClick
          )}
        </div>
      </div>
    );
  }

  private onReportPromptHover = (): void => {
    this.setState({promptHovered: true});
  };

  private onReportPromptUnhover = (): void => {
    this.setState({promptHovered: false, promptMinimized: false});
    this.minimizePromptAfterTimeout(PROMPT_DISPLAY_HOVER_TIMEOUT_MS);
  };

  private handleStopReportClick = (): void => {
    this.props.stopReport();
  };

  private handleRerunClick = (): void => {
    this.props.rerunReport(false);
  };

  private handleAlwaysRerunClick = (): void => {
    this.props.rerunReport(true);
  };

  private static promptButton(title: ReactNode, disabled: boolean, onClick: () => void): ReactNode {
    return (
      <Button outline size="sm" color="info" disabled={disabled} onClick={onClick}>
        <div>{title}</div>
      </Button>
    );
  }

  private static getConnectionStateUI(state: ConnectionState): ConnectionStateUI | undefined {
    switch (state) {
      case ConnectionState.INITIAL:
        return {
          icon: <use xlinkHref="./open-iconic.min.svg#ellipses"/>,
          label: 'Waiting',
          tooltip: 'Waiting for connection',
        };

      case ConnectionState.CONNECTED:
        return undefined;

      case ConnectionState.DISCONNECTED:
        return {
          icon: <use xlinkHref="./open-iconic.min.svg#circle-x"/>,
          label: 'Disconnected',
          tooltip: 'Disconnected from live data feed',
        };

      case ConnectionState.STATIC:
        return undefined;

      case ConnectionState.ERROR:
      default:
        return {
          icon: <use xlinkHref="./open-iconic.min.svg#warning"/>,
          label: 'Error',
          tooltip: 'Something went wrong!',
        };
    }
  }
}
