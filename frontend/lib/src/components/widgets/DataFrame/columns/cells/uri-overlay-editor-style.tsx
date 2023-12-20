/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import styled from "@emotion/styled"

// copied from glide's implementation for use with our LinkCell
// https://github.com/glideapps/glide-data-grid/blob/0ea52f371a5e2aaa8595aceefa40722d35410b1a/packages/core/src/data-grid-overlay-editor/data-grid-overlay-editor-style.tsx
export const UriOverlayEditorStyle = styled.div`
  display: flex;

  flex-grow: 1;

  align-items: center;

  min-height: 21px;

  .gdg-link-area {
    flex-grow: 1;
    flex-shrink: 1;

    cursor: pointer;

    margin-right: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    color: var(--gdg-link-color);
    text-decoration: underline !important;
    padding-bottom: 3px;
  }
`
