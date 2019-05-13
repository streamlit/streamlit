/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 *
 * @fileoverview UserSettings interface.
 */

export interface UserSettings {
  /**
   * If true, the report will be rendered with a wider column size
   */
  wideMode: boolean;

  /**
   * Flag indicating whether the server should re-run the report automatically
   * when its source file is modified on disk.
   *
   * The server passes the initial runOnSave value in its 'NewConnection'
   * forward message. If the value is modified via {@link App.saveSettings},
   * a 'setRunOnSave' message will be sent back to the server.
   */
  runOnSave: boolean;
}
