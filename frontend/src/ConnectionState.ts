/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

export enum ConnectionState {
  CONNECTED = 'CONNECTED',
  INITIAL_CONNECTING = 'CONNECTING',  // Treat differently in the UI.
  DISCONNECTED = 'DISCONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR',
  INITIAL = 'INITIAL',
  STATIC = 'STATIC',
}
