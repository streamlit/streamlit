/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

export enum ConnectionState {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR',
  INITIAL = 'INITIAL',
  INITIAL_CONNECTING = 'INITIAL_CONNECTING',  // Treat differently in the UI.
  RECONNECTING = 'RECONNECTING',
  STATIC = 'STATIC',
}
