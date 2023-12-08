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

class Buttons extends Component {
  render() {
    return (
      <div>
        <div className="page-header">
          <h3 className="page-title">Buttons</h3>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <a href="!#" onClick={event => event.preventDefault()}>
                  UI Elements
                </a>
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                Buttons
              </li>
            </ol>
          </nav>
        </div>
        <div className="row">
          <div className="col-12 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Normal buttons</h4>
                <p className="card-description">
                  Use any of the available button classes to quickly create a
                  styled button.
                </p>
                <div className="template-demo">
                  <button type="button" className="btn btn-primary">
                    Primary
                  </button>
                  <button type="button" className="btn btn-secondary">
                    Secondary
                  </button>
                  <button type="button" className="btn btn-success">
                    Success
                  </button>
                  <button type="button" className="btn btn-danger">
                    Danger
                  </button>
                  <button type="button" className="btn btn-warning">
                    Warning
                  </button>
                  <button type="button" className="btn btn-info">
                    Info
                  </button>
                  <button type="button" className="btn btn-light">
                    Light
                  </button>
                  <button type="button" className="btn btn-dark">
                    Dark
                  </button>
                  <button type="button" className="btn btn-link">
                    Link
                  </button>
                </div>
              </div>
              <div className="card-body">
                <h4 className="card-title">Rounded buttons</h4>
                <p className="card-description">
                  Add className <code>.btn-rounded</code>
                </p>
                <div className="template-demo">
                  <button
                    type="button"
                    className="btn btn-primary btn-rounded"
                  >
                    Primary
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-rounded"
                  >
                    Secondary
                  </button>
                  <button
                    type="button"
                    className="btn btn-success btn-rounded"
                  >
                    Success
                  </button>
                  <button type="button" className="btn btn-danger btn-rounded">
                    Danger
                  </button>
                  <button
                    type="button"
                    className="btn btn-warning btn-rounded"
                  >
                    Warning
                  </button>
                  <button type="button" className="btn btn-info btn-rounded">
                    Info
                  </button>
                  <button type="button" className="btn btn-light btn-rounded">
                    Light
                  </button>
                  <button type="button" className="btn btn-dark btn-rounded">
                    Dark
                  </button>
                  <button type="button" className="btn btn-link btn-rounded">
                    Link
                  </button>
                </div>
              </div>
              <div className="card-body">
                <h4 className="card-title">Outlined buttons</h4>
                <p className="card-description">
                  Add className <code>.btn-outline-&#123;color&#125;</code> for
                  outline buttons
                </p>
                <div className="template-demo">
                  <button type="button" className="btn btn-outline-primary">
                    Primary
                  </button>
                  <button type="button" className="btn btn-outline-secondary">
                    Secondary
                  </button>
                  <button type="button" className="btn btn-outline-success">
                    Success
                  </button>
                  <button type="button" className="btn btn-outline-danger">
                    Danger
                  </button>
                  <button type="button" className="btn btn-outline-warning">
                    Warning
                  </button>
                  <button type="button" className="btn btn-outline-info">
                    Info
                  </button>
                  <button type="button" className="btn btn-outline-light">
                    Light
                  </button>
                  <button type="button" className="btn btn-outline-dark">
                    Dark
                  </button>
                  <button type="button" className="btn btn-link">
                    Link
                  </button>
                </div>
              </div>
              <div className="card-body">
                <h4 className="card-title">Single color buttons</h4>
                <p className="card-description">
                  Add className <code>.btn-&#123;color&#125;</code> for buttons
                  in theme colors
                </p>
                <div className="template-demo">
                  <button type="button" className="btn btn-primary">
                    Primary
                  </button>
                  <button type="button" className="btn btn-secondary">
                    Secondary
                  </button>
                  <button type="button" className="btn btn-success">
                    Success
                  </button>
                  <button type="button" className="btn btn-danger">
                    Danger
                  </button>
                  <button type="button" className="btn btn-warning">
                    Warning
                  </button>
                  <button type="button" className="btn btn-info">
                    Info
                  </button>
                  <button type="button" className="btn btn-light">
                    Light
                  </button>
                  <button type="button" className="btn btn-dark">
                    Dark
                  </button>
                  <button type="button" className="btn btn-link">
                    Link
                  </button>
                </div>
              </div>
              <div className="card-body">
                <h4 className="card-title">Inverse buttons</h4>
                <p className="card-description">
                  Add className{" "}
                  <code>
                    .btn-inverse-&#123;color&#125; for inverse buttons
                  </code>
                </p>
                <div className="template-demo">
                  <button type="button" className="btn btn-inverse-primary">
                    Primary
                  </button>
                  <button type="button" className="btn btn-inverse-secondary">
                    Secondary
                  </button>
                  <button type="button" className="btn btn-inverse-success">
                    Success
                  </button>
                  <button type="button" className="btn btn-inverse-danger">
                    Danger
                  </button>
                  <button type="button" className="btn btn-inverse-warning">
                    Warning
                  </button>
                  <button type="button" className="btn btn-inverse-info">
                    Info
                  </button>
                  <button type="button" className="btn btn-inverse-light">
                    Light
                  </button>
                  <button type="button" className="btn btn-inverse-dark">
                    Dark
                  </button>
                  <button type="button" className="btn btn-link">
                    Link
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-8 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <div className="row">
                  <div className="col-xl-7 col-lg-9">
                    <h4 className="card-title">Icon Buttons</h4>
                    <p className="card-description">
                      Add className <code>.btn-icon</code> for buttons with
                      only icons
                    </p>
                    <div className="template-demo d-sm-flex justify-content-between flex-nowrap">
                      <button
                        type="button"
                        className="btn btn-primary btn-rounded btn-icon"
                      >
                        <i className="mdi mdi-home-outline"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-dark btn-rounded btn-icon"
                      >
                        <i className="mdi mdi-internet-explorer"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-rounded btn-icon"
                      >
                        <i className="mdi mdi-email-open"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-info btn-rounded btn-icon"
                      >
                        <i className="mdi mdi-star"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-success btn-rounded btn-icon"
                      >
                        <i className="mdi mdi-map-marker"></i>
                      </button>
                    </div>
                    <div className="template-demo d-sm-flex justify-content-between flex-nowrap">
                      <button
                        type="button"
                        className="btn btn-inverse-primary btn-rounded btn-icon"
                      >
                        <i className="mdi mdi-home-outline"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-inverse-dark btn-icon"
                      >
                        <i className="mdi mdi-internet-explorer"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-inverse-danger btn-icon"
                      >
                        <i className="mdi mdi-email-open"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-inverse-info btn-icon"
                      >
                        <i className="mdi mdi-star"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-inverse-success btn-icon"
                      >
                        <i className="mdi mdi-map-marker"></i>
                      </button>
                    </div>
                    <div className="template-demo d-sm-flex justify-content-between flex-nowrap mt-4">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-rounded btn-icon"
                      >
                        <i className="mdi mdi-heart-outline text-danger"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-rounded btn-icon"
                      >
                        <i className="mdi mdi-music text-dark"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-rounded btn-icon"
                      >
                        <i className="mdi mdi-star text-primary"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-rounded btn-icon"
                      >
                        <i className="mdi mdi-signal text-info"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-rounded btn-icon"
                      >
                        <i className="mdi mdi-trending-up text-success"></i>
                      </button>
                    </div>
                    <div className="template-demo d-sm-flex justify-content-between flex-nowrap">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-rounded btn-icon"
                      >
                        <i className="mdi mdi-heart-outline"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-rounded btn-icon"
                      >
                        <i className="mdi mdi-music"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-rounded btn-icon"
                      >
                        <i className="mdi mdi-star"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-rounded btn-icon"
                      >
                        <i className="mdi mdi-signal"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-rounded btn-icon"
                      >
                        <i className="mdi mdi-trending-up"></i>
                      </button>
                    </div>
                  </div>
                  <div className="col-xl-5 col-lg-3">
                    <h4 className="card-title">Button Size</h4>
                    <p className="card-description">
                      Use className <code>.btn-&#123;size&#125;</code>
                    </p>
                    <div className="template-demo">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-lg"
                      >
                        btn-lg
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-md"
                      >
                        btn-md
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                      >
                        btn-sm
                      </button>
                    </div>
                    <div className="template-demo mt-4">
                      <button type="button" className="btn btn-danger btn-lg">
                        btn-lg
                      </button>
                      <button type="button" className="btn btn-success btn-md">
                        btn-md
                      </button>
                      <button type="button" className="btn btn-primary btn-sm">
                        btn-sm
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-4 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Block buttons</h4>
                <p className="card-description">
                  Add className <code>.btn-block</code>
                </p>
                <div className="template-demo">
                  <button
                    type="button"
                    className="btn btn-info btn-lg btn-block"
                  >
                    Block buttons <i className="mdi mdi-menu float-right"></i>
                  </button>
                  <button
                    type="button"
                    className="btn btn-dark btn-lg btn-block"
                  >
                    Block buttons
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-lg btn-block"
                  >
                    <i className="mdi mdi-account"></i> Block buttons{" "}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-lg btn-block"
                  >
                    Block buttons
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 grid-margin">
            <div className="card">
              <div className="card-body">
                <div className="row">
                  <div className="col-md-6">
                    <h4 className="card-title">Button groups</h4>
                    <p className="card-description">
                      Wrap a series of buttons with <code>.btn</code> in{" "}
                      <code>.btn-group</code>
                    </p>
                    <div className="template-demo">
                      <div
                        className="btn-group"
                        role="group"
                        aria-label="Basic example"
                      >
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                        >
                          1
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                        >
                          2
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                        >
                          3
                        </button>
                      </div>
                      <div
                        className="btn-group"
                        role="group"
                        aria-label="Basic example"
                      >
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                        >
                          <i className="mdi mdi-heart-outline"></i>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                        >
                          <i className="mdi mdi-calendar"></i>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                        >
                          <i className="mdi mdi-clock"></i>
                        </button>
                      </div>
                    </div>
                    <div className="template-demo">
                      <div
                        className="btn-group"
                        role="group"
                        aria-label="Basic example"
                      >
                        <button type="button" className="btn btn-primary">
                          1
                        </button>
                        <button type="button" className="btn btn-primary">
                          2
                        </button>
                        <button type="button" className="btn btn-primary">
                          3
                        </button>
                      </div>
                      <div
                        className="btn-group"
                        role="group"
                        aria-label="Basic example"
                      >
                        <button type="button" className="btn btn-primary">
                          <i className="mdi mdi-heart-outline"></i>
                        </button>
                        <button type="button" className="btn btn-primary">
                          <i className="mdi mdi-calendar"></i>
                        </button>
                        <button type="button" className="btn btn-primary">
                          <i className="mdi mdi-clock"></i>
                        </button>
                      </div>
                    </div>
                    <div className="template-demo mt-4">
                      <div
                        className="btn-group-vertical"
                        role="group"
                        aria-label="Basic example"
                      >
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                        >
                          <i className="mdi mdi-format-vertical-align-top"></i>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                        >
                          <i className="mdi mdi-format-vertical-align-center"></i>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                        >
                          <i className="mdi mdi-format-vertical-align-bottom"></i>
                        </button>
                      </div>
                      <div
                        className="btn-group-vertical"
                        role="group"
                        aria-label="Basic example"
                      >
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                        >
                          Default
                        </button>
                        <div className="btn-group">
                          <button
                            type="button"
                            className="btn btn-outline-secondary dropdown-toggle"
                            data-toggle="dropdown"
                          >
                            Dropdown
                          </button>
                          <div className="dropdown-menu">
                            <a
                              href="!#"
                              onClick={event => event.preventDefault()}
                              className="dropdown-item"
                            >
                              Go back
                            </a>
                            <a
                              href="!#"
                              onClick={event => event.preventDefault()}
                              className="dropdown-item"
                            >
                              Delete
                            </a>
                            <a
                              href="!#"
                              onClick={event => event.preventDefault()}
                              className="dropdown-item"
                            >
                              Swap
                            </a>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                        >
                          Default
                        </button>
                      </div>
                      <div
                        className="btn-group-vertical"
                        role="group"
                        aria-label="Basic example"
                      >
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                        >
                          Top
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                        >
                          Middle
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                        >
                          Bottom
                        </button>
                      </div>
                    </div>
                    <div className="template-demo mt-4">
                      <div
                        className="btn-group"
                        role="group"
                        aria-label="Basic example"
                      >
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                        >
                          <i className="mdi mdi-star d-block mb-1"></i>{" "}
                          Favourites{" "}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                        >
                          <i className="mdi mdi-reload d-block mb-1"></i>{" "}
                          Reload{" "}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                        >
                          <i className="mdi mdi-account d-block mb-1"></i>{" "}
                          Users{" "}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <h4 className="card-title">Button with text and icon</h4>
                    <p className="card-description">
                      Wrap icon and text inside <code>.btn-icon-text</code> and
                      use <code>.btn-icon-prepend</code> or{" "}
                      <code>.btn-icon-append</code> for icon tags
                    </p>
                    <div className="template-demo">
                      <button
                        type="button"
                        className="btn btn-primary btn-icon-text"
                      >
                        <i className="mdi mdi-file-check btn-icon-prepend"></i>{" "}
                        Submit{" "}
                      </button>
                      <button
                        type="button"
                        className="btn btn-dark btn-icon-text"
                      >
                        {" "}
                        Edit{" "}
                        <i className="mdi mdi-file-check btn-icon-append"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-success btn-icon-text"
                      >
                        <i className="mdi mdi-alert btn-icon-prepend"></i>{" "}
                        Warning{" "}
                      </button>
                    </div>
                    <div className="template-demo">
                      <button
                        type="button"
                        className="btn btn-danger btn-icon-text"
                      >
                        <i className="mdi mdi-upload btn-icon-prepend"></i>{" "}
                        Upload{" "}
                      </button>
                      <button
                        type="button"
                        className="btn btn-info btn-icon-text"
                      >
                        {" "}
                        Print{" "}
                        <i className="mdi mdi-printer btn-icon-append"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-warning btn-icon-text"
                      >
                        <i className="mdi mdi-reload btn-icon-prepend"></i>{" "}
                        Reset{" "}
                      </button>
                    </div>
                    <div className="template-demo mt-2">
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-icon-text"
                      >
                        <i className="mdi mdi-file-check btn-icon-prepend"></i>{" "}
                        Submit{" "}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-icon-text"
                      >
                        {" "}
                        Edit{" "}
                        <i className="mdi mdi-file-check btn-icon-append"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-success btn-icon-text"
                      >
                        <i className="mdi mdi-alert btn-icon-prepend"></i>{" "}
                        Warning{" "}
                      </button>
                    </div>
                    <div className="template-demo">
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-icon-text"
                      >
                        <i className="mdi mdi-upload btn-icon-prepend"></i>{" "}
                        Upload{" "}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-info btn-icon-text"
                      >
                        {" "}
                        Print{" "}
                        <i className="mdi mdi-printer btn-icon-append"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-warning btn-icon-text"
                      >
                        <i className="mdi mdi-reload btn-icon-prepend"></i>{" "}
                        Reset{" "}
                      </button>
                    </div>
                    <div className="template-demo mt-2">
                      <button className="btn btn-dark btn-icon-text">
                        <i className="mdi mdi-apple btn-icon-prepend mdi-36px"></i>
                        <span className="d-inline-block text-left">
                          <small className="font-weight-light d-block">
                            Available on the
                          </small>{" "}
                          App Store{" "}
                        </span>
                      </button>
                      <button className="btn btn-dark btn-icon-text">
                        <i className="mdi mdi-android-debug-bridge btn-icon-prepend mdi-36px"></i>
                        <span className="d-inline-block text-left">
                          <small className="font-weight-light d-block">
                            Get it on the
                          </small>{" "}
                          Google Play{" "}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-6 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Social Icon Buttons</h4>
                <p className="card-description">
                  Add className <code>.btn-social-icon</code>
                </p>
                <div className="template-demo">
                  <button
                    type="button"
                    className="btn btn-social-icon btn-outline-facebook"
                  >
                    <i className="mdi mdi-facebook"></i>
                  </button>
                  <button
                    type="button"
                    className="btn btn-social-icon btn-outline-youtube"
                  >
                    <i className="mdi mdi-youtube"></i>
                  </button>
                  <button
                    type="button"
                    className="btn btn-social-icon btn-outline-twitter"
                  >
                    <i className="mdi mdi-twitter"></i>
                  </button>
                  <button
                    type="button"
                    className="btn btn-social-icon btn-outline-dribbble"
                  >
                    <i className="mdi mdi-dribbble"></i>
                  </button>
                  <button
                    type="button"
                    className="btn btn-social-icon btn-outline-linkedin"
                  >
                    <i className="mdi mdi-linkedin"></i>
                  </button>
                  <button
                    type="button"
                    className="btn btn-social-icon btn-outline-google"
                  >
                    <i className="mdi mdi-google-plus"></i>
                  </button>
                </div>
                <div className="template-demo">
                  <button
                    type="button"
                    className="btn btn-social-icon btn-facebook"
                  >
                    <i className="mdi mdi-facebook"></i>
                  </button>
                  <button
                    type="button"
                    className="btn btn-social-icon btn-youtube"
                  >
                    <i className="mdi mdi-youtube"></i>
                  </button>
                  <button
                    type="button"
                    className="btn btn-social-icon btn-twitter"
                  >
                    <i className="mdi mdi-twitter"></i>
                  </button>
                  <button
                    type="button"
                    className="btn btn-social-icon btn-dribbble"
                  >
                    <i className="mdi mdi-dribbble"></i>
                  </button>
                  <button
                    type="button"
                    className="btn btn-social-icon btn-linkedin"
                  >
                    <i className="mdi mdi-linkedin"></i>
                  </button>
                  <button
                    type="button"
                    className="btn btn-social-icon btn-google"
                  >
                    <i className="mdi mdi-google-plus"></i>
                  </button>
                </div>
                <div className="template-demo">
                  <button
                    type="button"
                    className="btn btn-social-icon btn-facebook btn-rounded"
                  >
                    <i className="mdi mdi-facebook"></i>
                  </button>
                  <button
                    type="button"
                    className="btn btn-social-icon btn-youtube btn-rounded"
                  >
                    <i className="mdi mdi-youtube"></i>
                  </button>
                  <button
                    type="button"
                    className="btn btn-social-icon btn-twitter btn-rounded"
                  >
                    <i className="mdi mdi-twitter"></i>
                  </button>
                  <button
                    type="button"
                    className="btn btn-social-icon btn-dribbble btn-rounded"
                  >
                    <i className="mdi mdi-dribbble"></i>
                  </button>
                  <button
                    type="button"
                    className="btn btn-social-icon btn-linkedin btn-rounded"
                  >
                    <i className="mdi mdi-linkedin"></i>
                  </button>
                  <button
                    type="button"
                    className="btn btn-social-icon btn-google btn-rounded"
                  >
                    <i className="mdi mdi-google-plus"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-6 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Social button with text</h4>
                <p className="card-description">
                  Add className <code>.btn-social-icon-text</code>
                </p>
                <div className="template-demo">
                  <button
                    type="button"
                    className="btn btn-social-icon-text btn-facebook"
                  >
                    <i className="mdi mdi-facebook"></i>Facebook
                  </button>
                  <button
                    type="button"
                    className="btn btn-social-icon-text btn-youtube"
                  >
                    <i className="mdi mdi-youtube"></i>Youtube
                  </button>
                  <button
                    type="button"
                    className="btn btn-social-icon-text btn-twitter"
                  >
                    <i className="mdi mdi-twitter"></i>Twitter
                  </button>
                  <button
                    type="button"
                    className="btn btn-social-icon-text btn-dribbble"
                  >
                    <i className="mdi mdi-dribbble"></i>Dribbble
                  </button>
                  <button
                    type="button"
                    className="btn btn-social-icon-text btn-linkedin"
                  >
                    <i className="mdi mdi-linkedin"></i>Linkedin
                  </button>
                  <button
                    type="button"
                    className="btn btn-social-icon-text btn-google"
                  >
                    <i className="mdi mdi-google-plus"></i>Google
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default Buttons
