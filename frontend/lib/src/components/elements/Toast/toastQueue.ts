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

import { type ReactNode } from "react"

import {
  type QueuedToast,
  UNSTABLE_ToastQueue as ToastQueue,
} from "react-aria-components/Toast"

/** Content for a standard ``st.toast``: a markdown body and optional icon. */
export interface StreamlitToastContent {
  body: string
  icon?: string
}

/**
 * Content for an app-level custom toast (e.g. the framework "install skills"
 * nudge) that reuses the shared toast queue and shell rather than a bespoke
 * one. The framework supplies a ``render`` callback so it can provide
 * arbitrary interactive content while inheriting the toast region's
 * positioning, elevation, animation, and accessibility. The ``ToastRegion``
 * render prop dispatches these via ``isCustomToastContent``; ``close``
 * dismisses this toast from the queue.
 */
export interface CustomToastContent {
  render: (toast: QueuedToast<ToastContent>, close: () => void) => ReactNode
}

/** Union of all content the shared toast queue can carry. */
export type ToastContent = StreamlitToastContent | CustomToastContent

/** Whether a queued toast carries app-level custom-rendered content. */
export function isCustomToastContent(
  content: ToastContent
): content is CustomToastContent {
  return "render" in content
}

export const toastQueue = new ToastQueue<ToastContent>({
  maxVisibleToasts: Infinity,
})
