/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import {BackMsg, ForwardMsg, IBackMsg} from './protobuf';
import {ConnectionState} from './ConnectionState';
import {logError, logMessage} from './log';

/**
 * Name of the logger.
 */
const LOG = 'WebsocketConnection';


/**
 * Timeout when attempting to connect to a local websocket, in millis. When
 * conneting to a local websocket, we retry forever. This should be at most
 * half the value of bootstrap.py#BROWSER_WAIT_TIMEOUT_SEC
 */
const LOCAL_CONNECTION_TIMEOUT_MS = 100;


/**
 * Number of times to try to connect to a remote websocket.
 */
const REMOTE_CONNECTION_MAX_RETRIES = 3;


/**
 * Timeout when attempting to connect to a remote websocket, in millis. This
 * grows by N with each Nth retry.
 */
const REMOTE_CONNECTION_TIMEOUT_MS = 2000;


interface Props {
  uriList: string[];

  /**
   * Function called when our ConnectionState changes.
   * If the new ConnectionState is ERROR, errMsg will be defined.
   */
  onConnectionStateChange: (connectionState: ConnectionState, errMsg?: string) => void;

  /** Function called when we receive a new message. */
  onMessage: (message: any) => void;

  /** XXX */
  isLocal: boolean;
}


interface MessageQueue {
  [index: number]: any;
}


type Event =
  'CONNECTION_ATTEMPT_STARTED'
  | 'CONNECTION_CLOSED'
  | 'CONNECTION_ERROR'
  | 'CONNECTION_SUCCEEDED'
  | 'CONNECTION_TIMED_OUT'
  | 'RETRIES_EXHAUSTED';


/**
 * This class is the "brother" of StaticConnection. The class connects to the
 * proxy and gets deltas over a websocket connection.
 */
export class WebsocketConnection {
  /**
   * List of URIs to try to connect to in round-robin fashion.
   */
  private uriList: string[];

  /**
   * Index to the URI in uriList that we're going to try to connect to.
   */
  private uriIndex: number = 0;

  /**
   * Function that tells the outside world that the connection state has
   * changed.
   */
  private onConnectionStateChange: (connectionState: ConnectionState, errMsg?: string) => void;

  /**
   * Function that receives incoming messages, so they can be handled by the
   * app at large.
   */
  private onMessage: (message: any) => void;

  /**
   * True if this Streamlit server that is serving this web app is running from
   * the same computer as this browser.
   */
  private isLocal: boolean;

  /**
   * How many times to retry connecting. May be Infinity!
   */
  private maxRetries: number;

  /**
   * To guarantee packet transmission order, this is the index of the last
   * dispatched incoming message.
   */
  private lastDispatchedMessageIndex: number = -1;

  /**
   * And this is the index of the next message we recieve.
   */
  private nextMessageIndex: number = 0;

  /**
   * This dictionary stores recieved messages that we haven't sent out yet
   * (because we're still decoding previous messages)
   */
  private messageQueue: MessageQueue = {};

  /**
   * The current state of this object's state machine.
   */
  private state = ConnectionState.INITIAL;

  /**
   * The WebSocket object we're connecting with.
   */
  private websocket?: WebSocket;

  /**
   * Keep track of how many times we tried to connect. For each "attempt" we
   * try *every* URI in uriList.
   */
  private attemptNumber: number = 0;

  /**
   * WebSocket objects don't support retries, so we have to implement them
   * ourselves. We use setTimeout to wait for a connection and retry once the
   * timeout fire. This is the timer ID from setTimeout, so we can cancel it if
   * needed.
   */
  private connectionTimeoutId: (number | null) = null;

  /**
   * Constructor.
   *
   * How this WebsocketConnection handles retries:
   *
   * - If isLocal == true: attempt to connect, and retry forever if it fails.
   *   Before retrying, wait RECONNECT_WAIT_TIME_MS, just so we don't hog the
   *   CPU (since most times the connection fails immediately). If the
   *   connection succeeds and then it fails (ctrl-c on the terminal), also
   *   retry forever just like before.
   *
   * - If isLocal == false: attempt to connect, and retry "maxRetries" times
   *   where during each "try" we attempt to connect to each of the URIs in
   *   urlList. Wait RECONNECT_WAIT_TIME_MS between retries just as before. The
   *   difference here is that most times the connection doesn't fail
   *   immediately (it can take a few hundred millis), so the reason why we
   *   wait a bit is not to keep the CPU happy but to give the remote server a
   *   chance to start up. After maxRetries, just error out and stop retrying.
   */
  public constructor(props: Props) {
    this.uriList = props.uriList;
    this.onConnectionStateChange = props.onConnectionStateChange;
    this.onMessage = props.onMessage;
    this.isLocal = props.isLocal;
    this.maxRetries = props.isLocal ?
      Infinity : REMOTE_CONNECTION_MAX_RETRIES;

    this.startConnectionAttempt();
  }

  private stepStateMachine(event: Event): void {
    logMessage(LOG, `State: ${this.state}; Event: ${event}`);

    // In case there's a connection in progress, stop the connection timeout
    // timer.
    if (this.connectionTimeoutId != null) {
      window.clearTimeout(this.connectionTimeoutId);
    }

    const setState = (state: ConnectionState, msg?: string): void => {
      logMessage(LOG, `New state: ${state}`);
      this.state = state;
      this.onConnectionStateChange(state, msg);
    };

    // Anything combination of state+event that is not explicitly called out
    // below is illegal and raises an error.

    switch (this.state) {
      case ConnectionState.INITIAL:
        if (event === 'CONNECTION_ATTEMPT_STARTED') {
          setState(ConnectionState.INITIAL_CONNECTING);
          return;
        }
        break;

      case ConnectionState.DISCONNECTED:
      case ConnectionState.ERROR:
        if (event === 'CONNECTION_ATTEMPT_STARTED') {
          setState(ConnectionState.RECONNECTING);
          return;
        }
        break;

      case ConnectionState.INITIAL_CONNECTING:
      case ConnectionState.RECONNECTING:
        if (event === 'CONNECTION_SUCCEEDED') {
          setState(ConnectionState.CONNECTED);
          return;

        } else if (event === 'CONNECTION_TIMED_OUT' ||
                   event === 'CONNECTION_ERROR' ||
                   event === 'CONNECTION_CLOSED') {
          setState(ConnectionState.DISCONNECTED);
          this.continueConnectionAttempt();
          return;

        } else if (event == 'RETRIES_EXHAUSTED') {
          setState(ConnectionState.ERROR, 'Retries exhausted');
          return;
        }
        break;

      case ConnectionState.CONNECTED:
        if (event === 'CONNECTION_CLOSED') {
          setState(ConnectionState.DISCONNECTED);
          this.startConnectionAttempt();
          return;
        }
        break;

      case ConnectionState.STATIC:
      default:
        break;
    }

    throw new Error(
      'Unsupported state transition.\n' +
      `State: ${this.state}\n` +
      `Event: ${event}`);
  }

  private startConnectionAttempt(): void {
    this.uriIndex = 0;
    this.connectToWebSocket();
  }

  private continueConnectionAttempt(): void {
    this.uriIndex++;

    if (this.uriIndex >= this.uriList.length) {
      this.attemptNumber++;
      if (this.attemptNumber < this.maxRetries) {
        this.uriIndex = 0;
      } else {
        this.stepStateMachine('RETRIES_EXHAUSTED');
        return;
      }
    }

    this.connectToWebSocket();
  }

  private connectToWebSocket(): void {
    this.stepStateMachine('CONNECTION_ATTEMPT_STARTED');

    const uri = this.uriList[this.uriIndex];

    if (this.websocket != null) {
      logMessage(LOG, 'closing WebSocket');
      this.websocket.close();
    }

    logMessage(LOG, 'creating WebSocket');
    this.websocket = new WebSocket(uri);

    const localWebsocket = this.websocket;

    const checkWebsocket = (): boolean => {
      return localWebsocket === this.websocket;
    };

    this.websocket.onmessage = (event: MessageEvent) => {
      if (checkWebsocket()) {
        this.handleMessage(event.data);
      }
    };

    this.websocket.onopen = () => {
      if (checkWebsocket()) {
        logMessage(LOG, 'WebSocket onopen');
        this.stepStateMachine('CONNECTION_SUCCEEDED');
      }
    };

    this.websocket.onclose = () => {
      if (checkWebsocket()) {
        logMessage(LOG, 'WebSocket onclose');
        this.stepStateMachine('CONNECTION_CLOSED');
      }
    };

    this.websocket.onerror = () => {
      if (checkWebsocket()) {
        logMessage(LOG, 'WebSocket onerror');
        this.stepStateMachine('CONNECTION_ERROR');
      }
    };
  }

  private setConnectionTimeout(): void {
    const timeoutMs = this.isLocal ?
      LOCAL_CONNECTION_TIMEOUT_MS :
      REMOTE_CONNECTION_TIMEOUT_MS * (this.attemptNumber + 1);

    const localWebsocket = this.websocket;

    this.connectionTimeoutId = window.setTimeout(() => {
      if (localWebsocket !== this.websocket) {
        return;
      }

      if (this.websocket == null) {
        // This should never happen! The only place we call
        // setConnectionTimeout() should be immediately before setting
        // this.websocket.
        this.stepStateMachine('CONNECTION_ERROR');
        return;
      }

      if (this.websocket.readyState === 0 /* CONNECTING */) {
        logError(LOG, `${this.uriList[this.uriIndex]} timed out`);
        this.stepStateMachine('CONNECTION_TIMED_OUT');
      }
    }, timeoutMs);
  }

  /**
   * Encodes the message with the outgoingMessageType and sends it over the
   * wire.
   */
  public sendMessage(obj: IBackMsg): void {
    if (!this.websocket) {
      return;
    }
    const msg = BackMsg.create(obj);
    const buffer = BackMsg.encode(msg).finish();
    this.websocket.send(buffer);
  }

  private handleMessage(data: any): void {
    // Assign this message an index.
    const messageIndex = this.nextMessageIndex;
    this.nextMessageIndex += 1;

    // Read in the message data.
    const reader = new FileReader();
    reader.readAsArrayBuffer(data);
    reader.onloadend = () => {
      if (this.messageQueue === undefined) {
        logError('No message queue.');
        return;
      }

      const result = reader.result;
      if (result == null || typeof result === 'string') {
        logError(`Unexpected result from FileReader: ${result}.`);
        return;
      }

      //XXX const resultArray = new Uint8Array(reader.result as ArrayBuffer);
      const resultArray = new Uint8Array(result);
      this.messageQueue[messageIndex] = ForwardMsg.decode(resultArray);
      while ((this.lastDispatchedMessageIndex + 1) in this.messageQueue) {
        const dispatchMessageIndex = this.lastDispatchedMessageIndex + 1;
        this.onMessage(this.messageQueue[dispatchMessageIndex]);
        delete this.messageQueue[dispatchMessageIndex];
        this.lastDispatchedMessageIndex = dispatchMessageIndex;
      }
    };
  }
}
