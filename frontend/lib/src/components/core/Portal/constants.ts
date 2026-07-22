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
 * The DOM `id` of the single, app-level overlay container that all dataframe
 * overlays render into: glide-data-grid's in-cell editors, the column /
 * statistics / formatting / column-visibility / button-action menus, and
 * dataframe cell tooltips.
 *
 * This id is required (and must be exactly this value) because glide-data-grid
 * looks up a root-level element with it to mount its cell overlay editors:
 * https://github.com/glideapps/glide-data-grid/blob/main/packages/core/API.md#htmlcss-prerequisites
 *
 * The node is created once by `PortalProvider` and portaled to `document.body`,
 * so it is a sibling of other overlays and unaffected by ancestor `transform`s
 * (e.g. from dialogs/popovers, which break `position: fixed`). Routing every
 * dataframe overlay through this shared container keeps them in one predictable
 * stacking layer (z-index `tablePortal`) and lets outside-click dismissal treat
 * them as a single region. Multiple overlays can safely coexist here (e.g. a
 * column menu plus its statistics sub-menu, or menus from different dataframes):
 * portals append children rather than replacing them, and each overlay is
 * positioned independently via explicit coordinates.
 */
export const DATAFRAME_PORTAL_ID = "portal"

/**
 * The DOM `id` of the shared, app-level host for `@floating-ui/react`'s
 * `FloatingPortal` mounts (e.g. the `st.popover` body).
 *
 * The host is created once by `PortalProvider` and portaled to `document.body`,
 * tagged with `data-react-aria-top-layer` so React Aria's dialog does not mark
 * it (or its subtree) as `inert` when the dialog is open — which would
 * otherwise make widgets inside a popover-in-dialog unclickable (see #16005) —
 * and with `data-st-overlay-root` so interacting with its children does not
 * dismiss the enclosing dialog or popover. The host has no dimensions of its
 * own; each floating child positions itself and carries its own `z-index`.
 */
export const FLOATING_OVERLAY_PORTAL_ID = "stFloatingOverlayPortal"
