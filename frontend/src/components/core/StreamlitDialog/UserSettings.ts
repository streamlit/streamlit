export interface UserSettings {
  /**
   * If true, the app will be rendered with a wider column size
   */
  wideMode: boolean

  /**
   * Flag indicating whether the server should re-run an app's scripts automatically
   * when their source files are modified on disk.
   *
   * The server passes the initial runOnSave value in its 'NewConnection'
   * forward message. If the value is modified via {@link App.saveSettings},
   * a 'setRunOnSave' message will be sent back to the server.
   */
  runOnSave: boolean
}
