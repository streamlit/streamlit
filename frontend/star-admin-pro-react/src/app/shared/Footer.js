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

import React, { Component } from "react"
// import { Trans } from 'react-i18next';

class Footer extends Component {
  render() {
    return (
      <footer className="footer">
        <div className="container-fluid">
          <div className="d-sm-flex justify-content-center justify-content-sm-between py-2 w-100">
            <span className="text-muted text-center text-sm-left d-block d-sm-inline-block">
              Copyright ©{" "}
              <a
                href="https://www.bootstrapdash.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                bootstrapdash.com{" "}
              </a>
              2020
            </span>
            <span className="float-none float-sm-right d-block mt-1 mt-sm-0 text-center">
              Free{" "}
              <a
                href="https://www.bootstrapdash.com/react-admin-templates/"
                target="_blank"
                rel="noopener noreferrer"
              >
                {" "}
                react admin{" "}
              </a>{" "}
              templates from BootstrapDash.com.{" "}
            </span>
          </div>
        </div>
      </footer>
    )
  }
}

export default Footer
