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
import {Button, UncontrolledTooltip} from 'reactstrap';
import {SignalConnection} from 'typed-signals';

import {ConnectionState} from './ConnectionState';
import {ReportEvent, ReportEventDispatcher} from './ReportEvent';
import './StatusWidget.scss';

/** Component props */
interface Props {
  /** State of our connection to the proxy. */
  connectionState: ConnectionState;

  /** Dispatches transient ReportEvents received from the proxy. */
  reportEventDispatcher: ReportEventDispatcher;

  /** True if the report is currently running. */
  reportIsRunning: boolean;

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
  minimized: boolean;

  /**
   * If true, the user requested that the running report be stopped.
   * This is reverted to false in getDerivedStateFromProps when the report
   * is stopped.
   */
  stopRequested: boolean;

  /**
   * If true, the server has told us that the report has changed and is
   * not being automatically re-run; we'll prompt the user to manually
   * re-run when this happens.
   *
   * This is reverted to false in getDerivedStateFromProps when the report
   * begins running again.
   */
  reportChangedOnDisk: boolean;

  /** True when the user requested that the report be re-run. */
  rerunRequested: boolean;
}

interface ConnectionStateUI {
  icon: ReactNode;
  label: string;
  tooltip: string;
}

const EVENT_DISPLAY_TIMEOUT_MS = 15000;  // 15sec

export class StatusWidget extends PureComponent<Props, State> {
  /** onReportEvent signal connection */
  private reportEventConn?: SignalConnection;

  public constructor(props: Props) {
    super(props);

    this.state = {
      minimized: StatusWidget.shouldMinimize(),
      stopRequested: false,
      reportChangedOnDisk: false,
      rerunRequested: false,
    };
  }

  /** Called by React on prop changes */
  public static getDerivedStateFromProps(props: Props): Partial<State> | null {
    // Reset transient event-related state when prop changes
    // render that state irrelevant
    if (!props.reportIsRunning) {
      return {stopRequested: false};
    } else {
      return {
        reportChangedOnDisk: false,
        rerunRequested: false,
      };
    }
  }

  public componentDidMount(): void {
    this.reportEventConn = this.props.reportEventDispatcher.onReportEvent.connect(
      evt => this.handleReportEvent(evt));
    window.addEventListener('scroll', this.handleScroll);
  }

  public componentWillUnmount(): void {
    if (this.reportEventConn !== undefined) {
      this.reportEventConn.disconnect();
      this.reportEventConn = undefined;
    }

    window.removeEventListener('scroll', this.handleScroll);
  }

  private handleReportEvent(event: ReportEvent): void {
    switch (event) {
      case ReportEvent.SOURCE_FILE_CHANGED:
        this.setState({reportChangedOnDisk: true});
        this.clearEventsAfterTimeout();
        break;

      default:
        console.warn(`Unhandled ReportEvent: ${event}`);
        break;
    }
  }

  private clearEventsAfterTimeout(): void {
    window.setTimeout(() => {
      this.setState({
        stopRequested: false,
        reportChangedOnDisk: false,
        rerunRequested: false,
      });
    }, EVENT_DISPLAY_TIMEOUT_MS);
  }

  private static shouldMinimize(): boolean {
    return window.scrollY > 32;
  }

  private handleScroll = (): void => {
    this.setState({
      minimized: StatusWidget.shouldMinimize(),
    });
  };

  public render(): ReactNode {
    if (this.props.reportIsRunning || this.state.rerunRequested) {
      // Show reportIsRunning when the report is actually running,
      // but also when the user has just requested a re-run.
      // In the latter case, the server should get around to actually
      // re-running the report in a second or two, but we can appear
      // more responsive by claiming it's started immemdiately.
      return this.renderReportIsRunning();
    } else if (this.state.reportChangedOnDisk) {
      return this.renderRerunReportPrompt();
    } else {
      return this.renderConnectionStatus();
    }
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
          className={this.state.minimized ? 'minimized' : ''}>
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
      stopButton = StatusWidget.promptButton(
        this.state.stopRequested ? 'Stopping...' : 'Stop',
        this.state.stopRequested,
        this.handleStopReportClick);
    }

    return (
      <div>
        <div
          id="ReportStatus"
          className={this.state.minimized ? 'minimized' : ''}>
          <img className="ReportRunningIcon" src="./icon_running.gif" alt="" />
          <label>
            Running...
          </label>
          {stopButton}

          {
            this.state.minimized ?
            <UncontrolledTooltip placement="bottom" target="ReportStatus">
              This script is currently running
            </UncontrolledTooltip> :
            ''
          }
        </div>
      </div>
    );
  }

  /** "Source file changed. [Rerun] [Always Rerun]" */
  private renderRerunReportPrompt(): ReactNode {
    return (
      <div>
        <div id="ReportStatus">
          <label className="prompt">
            Source file changed.
          </label>

          {StatusWidget.promptButton(
            'Rerun',
            this.state.rerunRequested,
            this.handleRerunClick
          )}

          {StatusWidget.promptButton(
            'Always rerun',
            this.state.rerunRequested,
            this.handleAlwaysRerunClick
          )}
        </div>
      </div>
    );
  }

  private handleStopReportClick = (): void => {
    this.setState({stopRequested: true});
    this.props.stopReport();
  };

  private handleRerunClick = (): void => {
    this.setState({rerunRequested: true});
    this.props.rerunReport(false);
  };

  private handleAlwaysRerunClick = (): void => {
    this.setState({rerunRequested: true});
    this.props.rerunReport(true);
  };

  private static promptButton(title: string, disabled: boolean, onClick: () => void): ReactNode {
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
          icon: <use xlinkHref="./open-iconic.min.svg#ellipses" />,
          label: 'Waiting',
          tooltip: 'Waiting for connection',
        };

      case ConnectionState.CONNECTED:
        return undefined;

      case ConnectionState.DISCONNECTED:
        return {
          icon: <use xlinkHref="./open-iconic.min.svg#circle-x" />,
          label: 'Disconnected',
          tooltip: 'Disconnected from live data feed',
        };

      case ConnectionState.STATIC:
        return undefined;

      case ConnectionState.ERROR:
      default:
        return {
          icon: <use xlinkHref="./open-iconic.min.svg#warning" />,
          label: 'Error',
          tooltip: 'Something went wrong!',
        };
    }
  }
}
