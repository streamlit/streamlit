/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

import {ConnectionState} from './ConnectionState'
import {logError} from './log'
import {BackMsg, ForwardMsg, IBackMsg} from 'autogen/protobuf'

/**
 * Number of times to try to connect to websocket.
 */
const MAX_RETRIES = 3

/**
 * Timeout for the WebSocket connection attempt, in millis. This grows by N
 * with each Nth retry.
 */
const CONNECTION_TIMEOUT_MS = 2000

interface Props {
  uriList: string[];

  /** Function called when we receive a new message. */
  onMessage: (message: any) => void;

  /**
   * Function called when our ConnectionState changes.
   * If the new ConnectionState is ERROR, errMsg will be defined.
   */
  setConnectionState: (connectionState: ConnectionState, errMsg?: string) => void;
}

/**
 * This class is the "brother" of StaticConnection. The class connects to the
 * proxy and gets deltas over a websocket connection.
 */
export class WebsocketConnection {
  private readonly props: Props;

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
  private messageQueue: { [index: number]: any } = {};

  /**
   * Keep track of how many times we tried to connect.
   */
  private attemptNumber: number = 0;

  private websocket?: WebSocket;

  public constructor(props: Props) {
    this.props = props
    this.connect(0)
  }

  private connect(uriIndex: number): void {
    const {uriList, setConnectionState, onMessage} = this.props

    if (uriIndex >= uriList.length) {
      this.attemptNumber += 1
      if (this.attemptNumber < MAX_RETRIES) {
        uriIndex = 0
      } else {
        setConnectionState(
          ConnectionState.ERROR,
          'The connection is down. Please rerun your Python script.')
        return
      }
    }

    let tryingNext = false

    const tryNext = (): void => {
      if (!tryingNext) {
        this.connect(uriIndex + 1)
        tryingNext = true
      }
    }

    const timeoutId = setTimeout(() => {
      if (this.websocket && this.websocket.readyState === 0) {
        logError(
          `Websocket connection to ${uriList[uriIndex]} timed out`)
        this.websocket.close()
        tryNext()
      }
    }, CONNECTION_TIMEOUT_MS * (this.attemptNumber + 1))

    const uri = uriList[uriIndex]
    this.websocket = new WebSocket(uri)

    this.websocket.onmessage = ({data}) => {
      this.handleMessage(data, onMessage)
    }

    this.websocket.onopen = () => {
      clearTimeout(timeoutId)
      setConnectionState(ConnectionState.CONNECTED)
    }

    this.websocket.onclose = () => {
      clearTimeout(timeoutId)
      setConnectionState(ConnectionState.DISCONNECTED)
    }

    this.websocket.onerror = () => {
      clearTimeout(timeoutId)
      tryNext()
    }
  }

  /**
   * Encodes the message with the outgoingMessageType and sends it over the
   * wire.
   */
  public sendMessage(obj: IBackMsg): void {
    if (!this.websocket) {
      return
    }
    const msg = BackMsg.create(obj)
    const buffer = BackMsg.encode(msg).finish()
    this.websocket.send(buffer)
  }

  private handleMessage(data: any, onMessage: (data: any) => void): void {
    // Assign this message an index.
    const messageIndex = this.nextMessageIndex
    this.nextMessageIndex += 1

    // Read in the message data.
    const reader = new FileReader()
    reader.readAsArrayBuffer(data)
    reader.onloadend = () => {
      if (this.messageQueue === undefined) {
        logError('No message queue.')
        return
      }

      const result = reader.result
      if (result == null || typeof result === 'string') {
        logError(`Unexpected result from FileReader: ${result}.`)
        return
      }

      const resultArray = new Uint8Array(result)
      this.messageQueue[messageIndex] = ForwardMsg.decode(resultArray)
      while ((this.lastDispatchedMessageIndex + 1) in this.messageQueue) {
        const dispatchMessageIndex = this.lastDispatchedMessageIndex + 1
        onMessage(this.messageQueue[dispatchMessageIndex])
        delete this.messageQueue[dispatchMessageIndex]
        this.lastDispatchedMessageIndex = dispatchMessageIndex
      }
    }
  }
}
