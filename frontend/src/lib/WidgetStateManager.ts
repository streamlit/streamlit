import {BackMsg, IBackMsg, WidgetState, WidgetStates} from 'autogen/protobuf'


/**
 * Manages widget values, and sends widget update messages back to the server.
 */
export class WidgetStateManager {
  /** Called to deliver a message to the server */
  private readonly sendBackMsg: (msg: IBackMsg) => void

  private readonly widgetStates: Map<string, WidgetState> = new Map<string, WidgetState>()
  private latestPendingMessage?: IBackMsg
  private widgetThrottleTimer?: number
  private lastBackMsgTime: number = 0

  public constructor(sendBackMsg: (msg: IBackMsg) => void) {
    this.sendBackMsg = sendBackMsg
  }

  public setTriggerValue(widgetId: string, value: boolean): void {
    this.getOrCreateWidgetStateProto(widgetId).triggerValue = value
  }

  public setBoolValue(widgetId: string, value: boolean): void {
    console.log(widgetId + ' ' + value)
    this.getOrCreateWidgetStateProto(widgetId).boolValue = value
  }

  public setIntValue(widgetId: string, value: number): void {
    this.getOrCreateWidgetStateProto(widgetId).intValue = value
  }

  public setFloatValue(widgetId: string, value: number): void {
    this.getOrCreateWidgetStateProto(widgetId).floatValue = value
  }

  public setStringValue(widgetId: string, value: string): void {
    this.getOrCreateWidgetStateProto(widgetId).stringValue = value
  }

  public setFloatArrayValue(widgetId: string, value: WidgetState.IFloatArray): void {
    this.getOrCreateWidgetStateProto(widgetId).floatArrayValue = value
  }

  public sendUpdateWidgetsMessage(): void {
    this.sendThrottledBackMsg(BackMsg.create({updateWidgets: this.createWigetStatesMsg()}))
  }

  private createWigetStatesMsg(): WidgetStates {
    const msg = new WidgetStates()
    this.widgetStates.forEach(value => msg.widgets.push(value))
    return msg
  }

  /**
   * Returns the WidgetState proto for the widget with the given ID.
   * If no such WidgetState exists yet, one will be created.
   */
  private getOrCreateWidgetStateProto(id: string): WidgetState {
    let state = this.getWidgetStateProto(id)
    if (state == null) {
      state = new WidgetState({id: id})
      this.widgetStates.set(id, state)
    }
    return state
  }

  private getWidgetStateProto(id: string): WidgetState | undefined {
    return this.widgetStates.get(id)
  }

  private sendThrottledBackMsg(msg: IBackMsg): void {
    const THROTTLE_MS = 400

    this.latestPendingMessage = msg

    if (this.widgetThrottleTimer !== undefined) {
      // A timer is already running. It'll send this BackMsg when
      // it wakes up
      return
    }

    const delta = Date.now() - this.lastBackMsgTime
    if (delta >= THROTTLE_MS) {
      // We can send our message immediately
      this.sendLatestWidgetBackMsg()
    } else {
      // Schedule our throttle timer
      this.widgetThrottleTimer = window.setTimeout(
        this.sendLatestWidgetBackMsg, THROTTLE_MS - delta)
    }
  }

  private sendLatestWidgetBackMsg = (): void => {
    if (this.latestPendingMessage != null) {
      this.sendBackMsg(this.latestPendingMessage)
      this.lastBackMsgTime = Date.now()
    }
    this.latestPendingMessage = undefined
    this.widgetThrottleTimer = undefined
  }

}
