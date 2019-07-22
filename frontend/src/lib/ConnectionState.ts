/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

export enum ConnectionState {
  CONNECTED = 'CONNECTED',
  DISCONNECTED_FOREVER = 'DISCONNECTED_FOREVER',
  INITIAL = 'INITIAL',
  PINGING_SERVER = 'PINGING_SERVER',
  CONNECTING = 'CONNECTING',
  STATIC = 'STATIC',
}
