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

import React from "react"
import { STREAMLIT_COMMUNITY_CLOUD_DOCS_URL } from "@streamlit/lib"
import { IDeployErrorDialog } from "./types"
import { StyledParagraph } from "./styled-components"

function NoRepositoryDetected(): IDeployErrorDialog {
  return {
    title: "Unable to deploy",
    body: (
      <StyledParagraph>
        The app’s code is not connected to a remote GitHub repository. To
        deploy on Streamlit Community Cloud, please put your code in a GitHub
        repository and publish the current branch. Read more in{" "}
        <a
          href={STREAMLIT_COMMUNITY_CLOUD_DOCS_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          our documentation
        </a>
        .
      </StyledParagraph>
    ),
  }
}

export default NoRepositoryDetected
