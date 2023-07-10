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

// This file is only used in tests, so these imports can be in devDependencies
/* eslint-disable import/no-extraneous-dependencies */
import { configure } from "enzyme"
import Adapter from "@wojtekmaj/enzyme-adapter-react-17"

configure({ adapter: new Adapter() })

/* eslint @typescript-eslint/no-var-requires: "off" */
// We need MessageChannel for BokehChart.test.tsx as we import bokeh scripts that use MessageChannel and jsdom doesn't define it (https://github.com/jsdom/jsdom/issues/2448)
// Additionally: the test command in package.json now uses the --experimental-worker node option in order to define the message channel
window.MessageChannel = require("worker_threads").MessageChannel
