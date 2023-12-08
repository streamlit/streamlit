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
import { Form } from "react-bootstrap"
import DatePicker from "react-datepicker"
import bsCustomFileInput from "bs-custom-file-input"

export class BasicElements extends Component {
  state = {
    startDate: new Date(),
  }

  handleChange = date => {
    this.setState({
      startDate: date,
    })
  }

  componentDidMount() {
    bsCustomFileInput.init()
  }

  render() {
    return (
      <div>
        <div className="page-header">
          <h3 className="page-title"> Form elements </h3>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <a href="!#" onClick={event => event.preventDefault()}>
                  Forms
                </a>
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                Form elements
              </li>
            </ol>
          </nav>
        </div>
        <div className="row">
          <div className="col-md-6 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Default form</h4>
                <p className="card-description"> Basic form layout </p>
                <form className="forms-sample">
                  <Form.Group>
                    <label htmlFor="exampleInputUsername1">Username</label>
                    <Form.Control
                      type="text"
                      id="exampleInputUsername1"
                      placeholder="Username"
                      size="lg"
                    />
                  </Form.Group>
                  <Form.Group>
                    <label htmlFor="exampleInputEmail1">Email address</label>
                    <Form.Control
                      type="email"
                      className="form-control"
                      id="exampleInputEmail1"
                      placeholder="Email"
                    />
                  </Form.Group>
                  <Form.Group>
                    <label htmlFor="exampleInputPassword1">Password</label>
                    <Form.Control
                      type="password"
                      className="form-control"
                      id="exampleInputPassword1"
                      placeholder="Password"
                    />
                  </Form.Group>
                  <Form.Group>
                    <label htmlFor="exampleInputConfirmPassword1">
                      Confirm Password
                    </label>
                    <Form.Control
                      type="password"
                      className="form-control"
                      id="exampleInputConfirmPassword1"
                      placeholder="Password"
                    />
                  </Form.Group>
                  <div className="form-check">
                    <label className="form-check-label text-muted">
                      <input type="checkbox" className="form-check-input" />
                      <i className="input-helper"></i>
                      Remember me
                    </label>
                  </div>
                  <button type="submit" className="btn btn-primary mr-2">
                    Submit
                  </button>
                  <button className="btn btn-light">Cancel</button>
                </form>
              </div>
            </div>
          </div>
          <div className="col-md-6 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Horizontal Form</h4>
                <p className="card-description"> Horizontal form layout </p>
                <form className="forms-sample">
                  <Form.Group className="row">
                    <label
                      htmlFor="exampleInputUsername2"
                      className="col-sm-3 col-form-label"
                    >
                      Email
                    </label>
                    <div className="col-sm-9">
                      <Form.Control
                        type="text"
                        className="form-control"
                        id="exampleInputUsername2"
                        placeholder="Username"
                      />
                    </div>
                  </Form.Group>
                  <Form.Group className="row">
                    <label
                      htmlFor="exampleInputEmail2"
                      className="col-sm-3 col-form-label"
                    >
                      Email
                    </label>
                    <div className="col-sm-9">
                      <Form.Control
                        type="email"
                        className="form-control"
                        id="exampleInputEmail2"
                        placeholder="Email"
                      />
                    </div>
                  </Form.Group>
                  <Form.Group className="row">
                    <label
                      htmlFor="exampleInputMobile"
                      className="col-sm-3 col-form-label"
                    >
                      Mobile
                    </label>
                    <div className="col-sm-9">
                      <Form.Control
                        type="text"
                        className="form-control"
                        id="exampleInputMobile"
                        placeholder="Mobile number"
                      />
                    </div>
                  </Form.Group>
                  <Form.Group className="row">
                    <label
                      htmlFor="exampleInputPassword2"
                      className="col-sm-3 col-form-label"
                    >
                      Password
                    </label>
                    <div className="col-sm-9">
                      <Form.Control
                        type="password"
                        className="form-control"
                        id="exampleInputPassword2"
                        placeholder="Password"
                      />
                    </div>
                  </Form.Group>
                  <Form.Group className="row">
                    <label
                      htmlFor="exampleInputConfirmPassword2"
                      className="col-sm-3 col-form-label"
                    >
                      Re Password
                    </label>
                    <div className="col-sm-9">
                      <Form.Control
                        type="password"
                        className="form-control"
                        id="exampleInputConfirmPassword2"
                        placeholder="Password"
                      />
                    </div>
                  </Form.Group>
                  <div className="form-check">
                    <label className="form-check-label text-muted">
                      <input type="checkbox" className="form-check-input" />
                      <i className="input-helper"></i>
                      Remember me
                    </label>
                  </div>
                  <button type="submit" className="btn btn-primary mr-2">
                    Submit
                  </button>
                  <button className="btn btn-light">Cancel</button>
                </form>
              </div>
            </div>
          </div>
          <div className="col-12 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Basic form elements</h4>
                <p className="card-description"> Basic form elements </p>
                <form className="forms-sample">
                  <Form.Group>
                    <label htmlFor="exampleInputName1">Name</label>
                    <Form.Control
                      type="text"
                      className="form-control"
                      id="exampleInputName1"
                      placeholder="Name"
                    />
                  </Form.Group>
                  <Form.Group>
                    <label htmlFor="exampleInputEmail3">Email address</label>
                    <Form.Control
                      type="email"
                      className="form-control"
                      id="exampleInputEmail3"
                      placeholder="Email"
                    />
                  </Form.Group>
                  <Form.Group>
                    <label htmlFor="exampleInputPassword4">Password</label>
                    <Form.Control
                      type="password"
                      className="form-control"
                      id="exampleInputPassword4"
                      placeholder="Password"
                    />
                  </Form.Group>
                  <Form.Group>
                    <label htmlFor="exampleSelectGender">Gender</label>
                    <select className="form-control" id="exampleSelectGender">
                      <option>Male</option>
                      <option>Female</option>
                    </select>
                  </Form.Group>
                  <Form.Group>
                    <label>File upload</label>
                    <div className="custom-file">
                      <Form.Control
                        type="file"
                        className="form-control visibility-hidden"
                        id="customFileLang"
                        lang="es"
                      />
                      <label
                        className="custom-file-label"
                        htmlFor="customFileLang"
                      >
                        Upload image
                      </label>
                    </div>
                  </Form.Group>
                  <Form.Group>
                    <label htmlFor="exampleInputCity1">City</label>
                    <Form.Control
                      type="text"
                      className="form-control"
                      id="exampleInputCity1"
                      placeholder="Location"
                    />
                  </Form.Group>
                  <Form.Group>
                    <label htmlFor="exampleTextarea1">Textarea</label>
                    <textarea
                      className="form-control"
                      id="exampleTextarea1"
                      rows="4"
                    ></textarea>
                  </Form.Group>
                  <button type="submit" className="btn btn-primary mr-2">
                    Submit
                  </button>
                  <button className="btn btn-light">Cancel</button>
                </form>
              </div>
            </div>
          </div>
          <div className="col-md-6 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Input size</h4>
                <p className="card-description">
                  {" "}
                  Add classNames like <code>.form-control-lg</code> and{" "}
                  <code>.form-control-sm</code>.{" "}
                </p>
                <Form.Group>
                  <label>Large input</label>
                  <Form.Control
                    type="text"
                    className="form-control-lg"
                    placeholder="Username"
                    aria-label="Username"
                  />
                </Form.Group>
                <Form.Group>
                  <label>Default input</label>
                  <Form.Control
                    type="text"
                    className="form-control"
                    placeholder="Username"
                    aria-label="Username"
                  />
                </Form.Group>
                <Form.Group>
                  <label>Small input</label>
                  <Form.Control
                    type="text"
                    className="form-control-sm"
                    placeholder="Username"
                    aria-label="Username"
                  />
                </Form.Group>
              </div>
            </div>
          </div>
          <div className="col-md-6 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Select size</h4>
                <p className="card-description">
                  {" "}
                  Add classNamees like <code>.form-control-lg</code> and{" "}
                  <code>.form-control-sm</code>.{" "}
                </p>
                <Form.Group>
                  <label htmlFor="exampleFormControlSelect1">
                    Large select
                  </label>
                  <select
                    className="form-control form-control-lg"
                    id="exampleFormControlSelect1"
                  >
                    <option>1</option>
                    <option>2</option>
                    <option>3</option>
                    <option>4</option>
                    <option>5</option>
                  </select>
                </Form.Group>
                <Form.Group>
                  <label htmlFor="exampleFormControlSelect2">
                    Default select
                  </label>
                  <select
                    className="form-control"
                    id="exampleFormControlSelect2"
                  >
                    <option>1</option>
                    <option>2</option>
                    <option>3</option>
                    <option>4</option>
                    <option>5</option>
                  </select>
                </Form.Group>
                <Form.Group>
                  <label htmlFor="exampleFormControlSelect3">
                    Small select
                  </label>
                  <select
                    className="form-control form-control-sm"
                    id="exampleFormControlSelect3"
                  >
                    <option>1</option>
                    <option>2</option>
                    <option>3</option>
                    <option>4</option>
                    <option>5</option>
                  </select>
                </Form.Group>
              </div>
            </div>
          </div>
          <div className="col-md-6 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Basic input groups</h4>
                <p className="card-description">
                  {" "}
                  Basic bootstrap input groups{" "}
                </p>
                <Form.Group>
                  <div className="input-group">
                    <div className="input-group-prepend">
                      <span className="input-group-text">@</span>
                    </div>
                    <Form.Control
                      type="text"
                      className="form-control"
                      placeholder="Username"
                      aria-label="Username"
                      aria-describedby="basic-addon1"
                    />
                  </div>
                </Form.Group>
                <Form.Group>
                  <div className="input-group">
                    <div className="input-group-prepend">
                      <span className="input-group-text bg-primary text-white">
                        $
                      </span>
                    </div>
                    <Form.Control
                      type="text"
                      className="form-control"
                      aria-label="Amount (to the nearest dollar)"
                    />
                    <div className="input-group-append">
                      <span className="input-group-text">.00</span>
                    </div>
                  </div>
                </Form.Group>
                <Form.Group>
                  <div className="input-group">
                    <div className="input-group-prepend">
                      <span className="input-group-text">$</span>
                    </div>
                    <div className="input-group-prepend">
                      <span className="input-group-text">0.00</span>
                    </div>
                    <Form.Control
                      type="text"
                      className="form-control"
                      aria-label="Amount (to the nearest dollar)"
                    />
                  </div>
                </Form.Group>
                <Form.Group>
                  <div className="input-group">
                    <Form.Control
                      type="text"
                      className="form-control"
                      placeholder="Recipient's username"
                      aria-label="Recipient's username"
                      aria-describedby="basic-addon2"
                    />
                    <div className="input-group-append">
                      <button className="btn btn-sm btn-primary" type="button">
                        Search
                      </button>
                    </div>
                  </div>
                </Form.Group>
                <Form.Group>
                  <div className="input-group">
                    <div className="input-group-prepend">
                      <button
                        className="btn btn-sm btn-outline-primary dropdown-toggle"
                        type="button"
                        data-toggle="dropdown"
                        aria-haspopup="true"
                        aria-expanded="false"
                      >
                        Dropdown
                      </button>
                      <div className="dropdown-menu">
                        <a
                          className="dropdown-item"
                          href="!#"
                          onClick={event => event.preventDefault()}
                        >
                          Action
                        </a>
                        <a
                          className="dropdown-item"
                          href="!#"
                          onClick={event => event.preventDefault()}
                        >
                          Another action
                        </a>
                        <a
                          className="dropdown-item"
                          href="!#"
                          onClick={event => event.preventDefault()}
                        >
                          Something else here
                        </a>
                        <div
                          role="separator"
                          className="dropdown-divider"
                        ></div>
                        <a
                          className="dropdown-item"
                          href="!#"
                          onClick={event => event.preventDefault()}
                        >
                          Separated link
                        </a>
                      </div>
                    </div>
                    <Form.Control
                      type="text"
                      className="form-control"
                      aria-label="Text input with dropdown button"
                    />
                  </div>
                </Form.Group>
                <Form.Group>
                  <div className="input-group">
                    <Form.Control
                      type="text"
                      className="form-control"
                      placeholder="Find in facebook"
                      aria-label="Recipient's username"
                      aria-describedby="basic-addon2"
                    />
                    <div className="input-group-append">
                      <button
                        className="btn btn-sm btn-facebook"
                        type="button"
                      >
                        <i className="mdi mdi-facebook"></i>
                      </button>
                    </div>
                  </div>
                </Form.Group>
              </div>
            </div>
          </div>
          <div className="col-md-6 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Checkbox Controls</h4>
                <p className="card-description">
                  Checkbox and radio controls (default appearance is in primary
                  color)
                </p>
                <form>
                  <div className="row">
                    <div className="col-md-6">
                      <Form.Group>
                        <div className="form-check">
                          <label className="form-check-label">
                            <input
                              type="checkbox"
                              className="form-check-input"
                            />
                            <i className="input-helper"></i>
                            Default
                          </label>
                        </div>
                        <div className="form-check">
                          <label className="form-check-label">
                            <input
                              type="checkbox"
                              defaultChecked
                              className="form-check-input"
                            />
                            <i className="input-helper"></i>
                            Checked
                          </label>
                        </div>
                        <div className="form-check">
                          <label className="form-check-label">
                            <input
                              type="checkbox"
                              disabled
                              className="form-check-input"
                            />
                            <i className="input-helper"></i>
                            Disabled
                          </label>
                        </div>
                        <div className="form-check">
                          <label className="form-check-label">
                            <input
                              type="checkbox"
                              disabled
                              defaultChecked
                              className="form-check-input"
                            />
                            <i className="input-helper"></i>
                            Disabled checked
                          </label>
                        </div>
                      </Form.Group>
                    </div>
                    <div className="col-md-6">
                      <Form.Group>
                        <div className="form-check">
                          <label className="form-check-label">
                            <input
                              type="radio"
                              className="form-check-input"
                              name="optionsRadios"
                              id="optionsRadios1"
                              value=""
                            />
                            <i className="input-helper"></i>
                            Default
                          </label>
                        </div>
                        <div className="form-check">
                          <label className="form-check-label">
                            <input
                              type="radio"
                              className="form-check-input"
                              name="optionsRadios"
                              id="optionsRadios2"
                              value="option2"
                              defaultChecked
                            />
                            <i className="input-helper"></i>
                            Selected
                          </label>
                        </div>
                        <div className="form-check">
                          <label className="form-check-label">
                            <input
                              type="radio"
                              className="form-check-input"
                              name="optionsRadios2"
                              id="optionsRadios3"
                              value="option3"
                              disabled
                            />
                            <i className="input-helper"></i>
                            Disabled
                          </label>
                        </div>
                        <div className="form-check">
                          <label className="form-check-label">
                            <input
                              type="radio"
                              className="form-check-input"
                              name="optionsRadios2"
                              id="optionsRadios4"
                              value="option4"
                              disabled
                              defaultChecked
                            />
                            <i className="input-helper"></i>
                            Selected and disabled
                          </label>
                        </div>
                      </Form.Group>
                    </div>
                  </div>
                </form>
              </div>
              <div className="card-body">
                <p className="card-description">
                  Add className <code>.form-check-&#123;color&#123;</code> for
                  checkbox and radio controls in theme colors
                </p>
                <form>
                  <div className="row">
                    <div className="col-md-6">
                      <Form.Group>
                        <div className="form-check form-check-primary">
                          <label className="form-check-label">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              defaultChecked
                            />{" "}
                            Primary
                            <i className="input-helper"></i>
                          </label>
                        </div>
                        <div className="form-check form-check-success">
                          <label className="form-check-label">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              defaultChecked
                            />{" "}
                            Success
                            <i className="input-helper"></i>
                          </label>
                        </div>
                        <div className="form-check form-check-info">
                          <label className="form-check-label">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              defaultChecked
                            />{" "}
                            Info
                            <i className="input-helper"></i>
                          </label>
                        </div>
                        <div className="form-check form-check-danger">
                          <label className="form-check-label">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              defaultChecked
                            />{" "}
                            Danger
                            <i className="input-helper"></i>
                          </label>
                        </div>
                        <div className="form-check form-check-warning">
                          <label className="form-check-label">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              defaultChecked
                            />{" "}
                            Warning
                            <i className="input-helper"></i>
                          </label>
                        </div>
                      </Form.Group>
                    </div>
                    <div className="col-md-6">
                      <Form.Group>
                        <div className="form-check form-check-primary">
                          <label className="form-check-label">
                            <input
                              type="radio"
                              className="form-check-input"
                              name="ExampleRadio1"
                              id="ExampleRadio1"
                              defaultChecked
                            />{" "}
                            Primary
                            <i className="input-helper"></i>
                          </label>
                        </div>
                        <div className="form-check form-check-success">
                          <label className="form-check-label">
                            <input
                              type="radio"
                              className="form-check-input"
                              name="ExampleRadio2"
                              id="ExampleRadio2"
                              defaultChecked
                            />{" "}
                            Success
                            <i className="input-helper"></i>
                          </label>
                        </div>
                        <div className="form-check form-check-info">
                          <label className="form-check-label">
                            <input
                              type="radio"
                              className="form-check-input"
                              name="ExampleRadio3"
                              id="ExampleRadio3"
                              defaultChecked
                            />{" "}
                            Info
                            <i className="input-helper"></i>
                          </label>
                        </div>
                        <div className="form-check form-check-danger">
                          <label className="form-check-label">
                            <input
                              type="radio"
                              className="form-check-input"
                              name="ExampleRadio4"
                              id="ExampleRadio4"
                              defaultChecked
                            />{" "}
                            Danger
                            <i className="input-helper"></i>
                          </label>
                        </div>
                        <div className="form-check form-check-warning">
                          <label className="form-check-label">
                            <input
                              type="radio"
                              className="form-check-input"
                              name="ExampleRadio5"
                              id="ExampleRadio5"
                              defaultChecked
                            />{" "}
                            Warning
                            <i className="input-helper"></i>
                          </label>
                        </div>
                      </Form.Group>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="col-12 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Inline forms</h4>
                <p className="card-description">
                  {" "}
                  Use the <code>.form-inline</code> className to display a
                  series of labels, form controls, and buttons on a single
                  horizontal row{" "}
                </p>
                <form className="form-inline">
                  <label className="sr-only" htmlFor="inlineFormInputName2">
                    Name
                  </label>
                  <Form.Control
                    type="text"
                    className="form-control mb-2 mr-sm-2"
                    id="inlineFormInputName2"
                    placeholder="Jane Doe"
                  />
                  <label
                    className="sr-only"
                    htmlFor="inlineFormInputGroupUsername2"
                  >
                    Username
                  </label>
                  <div className="input-group mb-2 mr-sm-2">
                    <div className="input-group-prepend">
                      <div className="input-group-text">@</div>
                    </div>
                    <Form.Control
                      type="text"
                      className="form-control"
                      id="inlineFormInputGroupUsername2"
                      placeholder="Username"
                    />
                  </div>
                  <div className="form-check mx-sm-2">
                    <label className="form-check-label">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        defaultChecked
                      />{" "}
                      Remember me
                      <i className="input-helper"></i>
                    </label>
                  </div>
                  <button type="submit" className="btn btn-primary mb-2">
                    Submit
                  </button>
                </form>
              </div>
            </div>
          </div>
          <div className="col-12 grid-margin">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title">Horizontal Two column</h4>
                <form className="form-sample">
                  <p className="card-description"> Personal info </p>
                  <div className="row">
                    <div className="col-md-6">
                      <Form.Group className="row">
                        <label className="col-sm-3 col-form-label">
                          First Name
                        </label>
                        <div className="col-sm-9">
                          <Form.Control type="text" />
                        </div>
                      </Form.Group>
                    </div>
                    <div className="col-md-6">
                      <Form.Group className="row">
                        <label className="col-sm-3 col-form-label">
                          Last Name
                        </label>
                        <div className="col-sm-9">
                          <Form.Control type="text" />
                        </div>
                      </Form.Group>
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-md-6">
                      <Form.Group className="row">
                        <label className="col-sm-3 col-form-label">
                          Gender
                        </label>
                        <div className="col-sm-9">
                          <select className="form-control">
                            <option>Male</option>
                            <option>Female</option>
                          </select>
                        </div>
                      </Form.Group>
                    </div>
                    <div className="col-md-6">
                      <Form.Group className="row">
                        <label className="col-sm-3 col-form-label">
                          Date of Birth
                        </label>
                        <div className="col-sm-9">
                          <DatePicker
                            className="form-control w-100"
                            selected={this.state.startDate}
                            onChange={this.handleChange}
                          />
                        </div>
                      </Form.Group>
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-md-6">
                      <Form.Group className="row">
                        <label className="col-sm-3 col-form-label">
                          Category
                        </label>
                        <div className="col-sm-9">
                          <select className="form-control">
                            <option>Category1</option>
                            <option>Category2</option>
                            <option>Category3</option>
                            <option>Category4</option>
                          </select>
                        </div>
                      </Form.Group>
                    </div>
                    <div className="col-md-6">
                      <Form.Group className="row">
                        <label className="col-sm-3 col-form-label">
                          Membership
                        </label>
                        <div className="col-sm-4">
                          <div className="form-check">
                            <label className="form-check-label">
                              <input
                                type="radio"
                                className="form-check-input"
                                name="ExampleRadio4"
                                id="membershipRadios1"
                                defaultChecked
                              />{" "}
                              Free
                              <i className="input-helper"></i>
                            </label>
                          </div>
                        </div>
                        <div className="col-sm-5">
                          <div className="form-check">
                            <label className="form-check-label">
                              <input
                                type="radio"
                                className="form-check-input"
                                name="ExampleRadio4"
                                id="membershipRadios2"
                              />{" "}
                              Proffessional
                              <i className="input-helper"></i>
                            </label>
                          </div>
                        </div>
                      </Form.Group>
                    </div>
                  </div>
                  <p className="card-description"> Address </p>
                  <div className="row">
                    <div className="col-md-6">
                      <Form.Group className="row">
                        <label className="col-sm-3 col-form-label">
                          Address 1
                        </label>
                        <div className="col-sm-9">
                          <Form.Control type="text" />
                        </div>
                      </Form.Group>
                    </div>
                    <div className="col-md-6">
                      <Form.Group className="row">
                        <label className="col-sm-3 col-form-label">
                          State 1
                        </label>
                        <div className="col-sm-9">
                          <Form.Control type="text" />
                        </div>
                      </Form.Group>
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-md-6">
                      <Form.Group className="row">
                        <label className="col-sm-3 col-form-label">
                          Address 2
                        </label>
                        <div className="col-sm-9">
                          <Form.Control type="text" />
                        </div>
                      </Form.Group>
                    </div>
                    <div className="col-md-6">
                      <Form.Group className="row">
                        <label className="col-sm-3 col-form-label">
                          Postcode
                        </label>
                        <div className="col-sm-9">
                          <Form.Control type="text" />
                        </div>
                      </Form.Group>
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-md-6">
                      <Form.Group className="row">
                        <label className="col-sm-3 col-form-label">Cirt</label>
                        <div className="col-sm-9">
                          <Form.Control type="text" />
                        </div>
                      </Form.Group>
                    </div>
                    <div className="col-md-6">
                      <Form.Group className="row">
                        <label className="col-sm-3 col-form-label">
                          Country
                        </label>
                        <div className="col-sm-9">
                          <select className="form-control">
                            <option>America</option>
                            <option>Italy</option>
                            <option>Russia</option>
                            <option>Britain</option>
                          </select>
                        </div>
                      </Form.Group>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default BasicElements
