import React from "react"
import { ONLINE_DOCS_URL } from "urls"
import { IDeployErrorDialog } from "./types"

function NoRepositoryDetected(): IDeployErrorDialog {
  return {
    title: "Error deploying app",
    body: (
      <>
        <p>No Github repository detected.</p>
        <p>How Streamlit sharing works:</p>
        <ul>
          <li>
            To deploy a public app, you must first put it in a public Github
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
            If you'd like to deploy a private app, sign up for Streamlit for
            Teams.
          </li>
        </ul>
      </>
    ),
  }
}

export default NoRepositoryDetected
