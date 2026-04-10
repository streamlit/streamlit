/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

/**
 * Perspective viewer custom element interface.
 * Based on @perspective-dev/viewer types.
 */
export interface PerspectiveViewerElement extends HTMLElement {
  /** Load a Perspective table or client into the viewer */
  load(table: PerspectiveTable | PerspectiveClient): Promise<void>

  /** Save the current viewer configuration */
  save(): Promise<Record<string, unknown>>

  /** Restore a viewer configuration */
  restore(config: Record<string, unknown>): Promise<void>

  /** Reset viewer themes */
  resetThemes(themes: string[]): Promise<void>

  /** Delete the viewer and free resources */
  delete(): Promise<void>

  /** Add event listener - extends HTMLElement's addEventListener */
  addEventListener(
    type: "perspective-config-update",
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void

  /** Remove event listener - extends HTMLElement's removeEventListener */
  removeEventListener(
    type: "perspective-config-update",
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void
}

/**
 * Perspective table interface.
 * Based on @perspective-dev/client types.
 */
export interface PerspectiveTable {
  /** Replace table data with Arrow IPC data */
  replace(data: ArrayBuffer | Uint8Array | string): Promise<void>

  /** Delete the table and free resources */
  delete(): Promise<void>

  /** Get the table name */
  get_name(): Promise<string>
}

/**
 * Perspective client interface for creating tables.
 * Based on @perspective-dev/client types.
 */
export interface PerspectiveClient {
  /** Create a new table from Arrow IPC data or other formats */
  table(
    data:
      | ArrayBuffer
      | Uint8Array
      | string
      | Record<string, unknown[]>
      | Record<string, unknown>[],
    options?: { name?: string; index?: string; limit?: number }
  ): Promise<PerspectiveTable>

  /** Terminate the client connection */
  terminate(): void
}
