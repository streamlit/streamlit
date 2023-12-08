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

import React, { Component, Suspense, lazy } from "react"
import { Switch, Route, Redirect } from "react-router-dom"

import Spinner from "../app/shared/Spinner"

const Dashboard = lazy(() => import("./dashboard/Dashboard"))

const Buttons = lazy(() => import("./basic-ui/Buttons"))
const Dropdowns = lazy(() => import("./basic-ui/Dropdowns"))

const BasicElements = lazy(() => import("./form-elements/BasicElements"))

const BasicTable = lazy(() => import("./tables/BasicTable"))

const Mdi = lazy(() => import("./icons/Mdi"))

const ChartJs = lazy(() => import("./charts/ChartJs"))

const Error404 = lazy(() => import("./error-pages/Error404"))
const Error500 = lazy(() => import("./error-pages/Error500"))

const Login = lazy(() => import("./user-pages/Login"))
const Register1 = lazy(() => import("./user-pages/Register"))

class AppRoutes extends Component {
  render() {
    return (
      <Suspense fallback={<Spinner />}>
        <Switch>
          <Route exact path="/" component={Dashboard} />

          <Route path="/basic-ui/buttons" component={Buttons} />
          <Route path="/basic-ui/dropdowns" component={Dropdowns} />

          <Route
            path="/form-Elements/basic-elements"
            component={BasicElements}
          />

          <Route path="/tables/basic-table" component={BasicTable} />

          <Route path="/icons/mdi" component={Mdi} />

          <Route path="/charts/chart-js" component={ChartJs} />

          <Route path="/user-pages/login-1" component={Login} />
          <Route path="/user-pages/register-1" component={Register1} />

          <Route path="/error-pages/error-404" component={Error404} />
          <Route path="/error-pages/error-500" component={Error500} />

          <Redirect to="/dashboard" />
        </Switch>
      </Suspense>
    )
  }
}

export default AppRoutes
