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
import { ONLINE_DOCS_URL, TEAMS_URL } from "src/urls"
import { IDeployErrorDialog } from "./types"

function NoRepositoryDetected(): IDeployErrorDialog {
  return {
    title: "Unable to deploy app",
    body: (
      <>
        <p>
          Could not find a remote repository hosted on GitHub. Are you sure you
          are on a branch that is tracking a remote GitHub branch?
        </p>
        <p>How Streamlit Cloud works:</p>
        <ul>
          <li>
            To deploy a public app, you must first put it in a public GitHub
            repo. See{" "}
            <a
              href={ONLINE_DOCS_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              our documentation
            </a>{" "}
            for more details.
          </li>
          <li>
            If you'd like to deploy a private app,{" "}
            <a href={TEAMS_URL} target="_blank" rel="noopener noreferrer">
              sign up for Streamlit for Teams
            </a>
            .
          </li>
        </ul>
      </>
    ),
  }
}

export default NoRepositoryDetected
