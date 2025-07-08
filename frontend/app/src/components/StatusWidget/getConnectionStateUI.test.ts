/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Ellipses, Warning } from "@emotion-icons/open-iconic"

import { ConnectionState } from "@streamlit/connection"

import {
  CONNECTING_LABEL,
  CONNECTING_STATIC_TOOLTIP_TEXT,
  CONNECTING_TOOLTIP_TEXT,
  ERROR_LABEL,
  ERROR_TOOLTIP_TEXT,
  getConnectionStateUI,
} from "./getConnectionStateUI"

describe("getConnectionStateUI", () => {
  it("Returns undefined for connected", () => {
    for (const state of [
      ConnectionState.CONNECTED,
      ConnectionState.STATIC_CONNECTED,
    ]) {
      const uiState = getConnectionStateUI(state)
      expect(uiState).toBeUndefined()
    }
  })

  it("Returns connecting UI state correctly", () => {
    for (const state of [
      ConnectionState.INITIAL,
      ConnectionState.PINGING_SERVER,
      ConnectionState.CONNECTING,
    ]) {
      const uiState = getConnectionStateUI(state)
      expect(uiState?.icon).toBe(Ellipses)
      expect(uiState?.label).toBe(CONNECTING_LABEL)
      expect(uiState?.tooltip).toBe(CONNECTING_TOOLTIP_TEXT)
    }
  })

  it("Returns static connecting UI state correctly", () => {
    const uiState = getConnectionStateUI(ConnectionState.STATIC_CONNECTING)
    expect(uiState?.icon).toBe(Ellipses)
    expect(uiState?.label).toBe(CONNECTING_LABEL)
    expect(uiState?.tooltip).toBe(CONNECTING_STATIC_TOOLTIP_TEXT)
  })

  it("Returns error UI state correctly", () => {
    const uiState = getConnectionStateUI(ConnectionState.DISCONNECTED_FOREVER)
    expect(uiState?.icon).toBe(Warning)
    expect(uiState?.label).toBe(ERROR_LABEL)
    expect(uiState?.tooltip).toBe(ERROR_TOOLTIP_TEXT)
  })
})
