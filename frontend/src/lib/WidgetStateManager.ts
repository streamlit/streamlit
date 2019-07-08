import {IBackMsg, BackMsg, FloatArray, WidgetState, WidgetStates} from 'autogen/protobuf'

/**
 * Manages widget values, and sends widget update messages back to the server.
 */
export class WidgetStateManager {
  // Called to deliver a message to the server
  private readonly sendBackMsg: (msg: IBackMsg) => void
  private readonly widgetStates: Map<string, WidgetState> = new Map<string, WidgetState>()

  public constructor(sendBackMsg: (msg: IBackMsg) => void) {
    this.sendBackMsg = sendBackMsg
  }

  /**
   * True if our widget state dict is empty. This will be the case only when the browser
   * initially connects to the server for the first time.
   */
  public get isEmpty(): boolean {
    return this.widgetStates.size === 0
  }

  public setTriggerValue(widgetId: string, value: boolean): void {
    this.getOrCreateWidgetStateProto(widgetId).triggerValue = value
  }

  public setBoolValue(widgetId: string, value: boolean): void {
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

  public setFloatArrayValue(widgetId: string, value: number[]): void {
    this.getOrCreateWidgetStateProto(widgetId).floatArrayValue = FloatArray.fromObject({ value })
  }

  public sendUpdateWidgetsMessage(): void {
    this.sendBackMsg(BackMsg.create({ updateWidgets: this.createWigetStatesMsg() }))
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
      state = new WidgetState({ id })
      this.widgetStates.set(id, state)
    }
    return state
  }

  private getWidgetStateProto(id: string): WidgetState | undefined {
    return this.widgetStates.get(id)
  }
}
