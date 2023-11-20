/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

export const UriOverlayEditorStyle = styled.div`
  display: flex;

  flex-grow: 1;

  align-items: center;

  min-height: 21px;

  .link-area {
    flex-grow: 1;
    flex-shrink: 1;

    cursor: pointer;

    margin-right: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    color: var(--gdg-link-color);
    text-decoration: underline !important;
  }

  .edit-icon {
    flex-shrink: 0;
    width: 32px;
    color: var(--gdg-accent-color);

    cursor: pointer;

    display: flex;
    justify-content: center;
    align-items: center;

    > * {
      width: 24px;
      height: 24px;
    }
  }

  textarea {
    position: absolute;
    top: 0px;
    left: 0px;
    width: 0px;
    height: 0px;

    opacity: 0;
  }
`
