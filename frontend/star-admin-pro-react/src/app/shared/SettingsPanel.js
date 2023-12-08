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
import { Tabs, Tab } from "react-bootstrap"
import { Trans } from "react-i18next"

export class SettingsPanel extends Component {
  constructor(props) {
    super(props)
    this.state = {
      todos: [
        {
          id: 1,
          task: "Pick up kids from school",
          isCompleted: false,
        },
        {
          id: 2,
          task: "Prepare for presentation",
          isCompleted: true,
        },
        {
          id: 3,
          task: "Print Statements",
          isCompleted: false,
        },
        {
          id: 4,
          task: "Create invoice",
          isCompleted: false,
        },
        {
          id: 5,
          task: "Call John",
          isCompleted: true,
        },
        {
          id: 6,
          task: "Meeting with Alisa",
          isCompleted: false,
        },
      ],
      todosRtl: [
        {
          id: 1,
          task: "التقاط الاطفال من المدرسة",
          isCompleted: false,
        },
        {
          id: 2,
          task: "الاستعداد للعرض التقديمي الخاص بك",
          isCompleted: true,
        },
        {
          id: 3,
          task: "طباعة البيانات",
          isCompleted: false,
        },
        {
          id: 4,
          task: "انشاء الفواتير",
          isCompleted: false,
        },
        {
          id: 5,
          task: "استدعاء جون",
          isCompleted: true,
        },
        {
          id: 6,
          task: "مقابلة مع اليسا",
          isCompleted: false,
        },
      ],
      inputValue: "",
    }

    this.statusChangedHandler = this.statusChangedHandler.bind(this)
    this.addTodo = this.addTodo.bind(this)
    this.removeTodo = this.removeTodo.bind(this)
    this.inputChangeHandler = this.inputChangeHandler.bind(this)
  }

  statusChangedHandler(event, id) {
    const todo = { ...this.state.todos[id] }
    todo.isCompleted = event.target.checked

    const todos = [...this.state.todos]
    todos[id] = todo

    this.setState({
      todos: todos,
    })
  }
  statusChangedHandlerRtl(event, id) {
    const todoRtl = { ...this.state.todosRtl[id] }
    todoRtl.isCompleted = event.target.checked

    const todosRtl = [...this.state.todosRtl]
    todosRtl[id] = todoRtl

    this.setState({
      todosRtl: todosRtl,
    })
  }

  addTodo(event) {
    event.preventDefault()

    const todos = [...this.state.todos]
    todos.unshift({
      id: todos.length ? todos[todos.length - 1].id + 1 : 1,
      task: this.state.inputValue,
      isCompleted: false,
    })

    this.setState({
      todos: todos,
      inputValue: "",
    })
  }
  addTodoRtl(event) {
    event.preventDefault()

    const todosRtl = [...this.state.todosRtl]
    todosRtl.unshift({
      id: todosRtl.length ? todosRtl[todosRtl.length - 1].id + 1 : 1,
      task: this.state.inputValue,
      isCompleted: false,
    })

    this.setState({
      todosRtl: todosRtl,
      inputValue: "",
    })
  }

  removeTodo(index) {
    const todos = [...this.state.todos]
    todos.splice(index, 1)

    this.setState({
      todos: todos,
    })
  }
  removeTodoRtl(index) {
    const todosRtl = [...this.state.todosRtl]
    todosRtl.splice(index, 1)

    this.setState({
      todosRtl: todosRtl,
    })
  }

  inputChangeHandler(event) {
    this.setState({
      inputValue: event.target.value,
    })
  }

  closeRightSidebar() {
    document.querySelector(".right-sidebar").classList.remove("open")
    //alert("abc")
  }

  render() {
    return (
      <div>
        {/* <div id="settings-trigger"><i className="mdi mdi-settings"></i></div> */}
        <div id="right-sidebar" className="settings-panel right-sidebar">
          <i
            className="settings-close mdi mdi-close"
            onClick={this.closeRightSidebar}
          ></i>
          <Tabs
            defaultActiveKey="TODOLIST"
            className="bg-primary"
            id="uncontrolled-tab-example"
          >
            <Tab eventKey="TODOLIST" title="TO DO LIST" className="test-tab">
              <div>
                <div className="row">
                  <div className="col-lg-12">
                    <div className="px-3">
                      <div>
                        <h4 className="card-title">
                          <Trans>Todo List</Trans>
                        </h4>
                        <form
                          className="add-items d-flex"
                          onSubmit={this.addTodo}
                        >
                          <input
                            type="text"
                            className="form-control h-auto"
                            placeholder="What do you need to do today?"
                            value={this.state.inputValue}
                            onChange={this.inputChangeHandler}
                            required
                          />
                          <button
                            type="submit"
                            className="btn btn-primary font-weight-bold"
                          >
                            <Trans>Add</Trans>
                          </button>
                        </form>
                        <div className="list-wrapper">
                          <ul className="todo-list">
                            {this.state.todos.map((todo, index) => {
                              return (
                                <ListItem
                                  isCompleted={todo.isCompleted}
                                  changed={event =>
                                    this.statusChangedHandler(event, index)
                                  }
                                  key={todo.id}
                                  remove={() => this.removeTodo(index)}
                                >
                                  {todo.task}
                                </ListItem>
                              )
                            })}
                          </ul>
                          <ul className="todo-list rtl-todo">
                            {this.state.todosRtl.map((todoRtl, index) => {
                              return (
                                <ListItem
                                  isCompleted={todoRtl.isCompleted}
                                  changed={event =>
                                    this.statusChangedHandler(event, index)
                                  }
                                  key={todoRtl.id}
                                  remove={() => this.removeTodoRtl(index)}
                                >
                                  {todoRtl.task}
                                </ListItem>
                              )
                            })}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="events py-4 border-bottom px-3">
                  <div className="wrapper d-flex mb-2">
                    <i className="mdi mdi-circle-outline text-primary"></i>
                    <span>
                      <Trans>Feb</Trans> 11 2018
                    </span>
                  </div>
                  <p className="mb-0 font-weight-thin text-gray">
                    <Trans>Creating component page</Trans>
                  </p>
                  <p className="text-gray mb-0">
                    <Trans>build a js based app</Trans>
                  </p>
                </div>
                <div className="events pt-4 px-3">
                  <div className="wrapper d-flex mb-2">
                    <i className="mdi mdi-circle-outline text-primary"></i>
                    <span>
                      <Trans>Feb</Trans> 7 2018
                    </span>
                  </div>
                  <p className="mb-0 font-weight-thin text-gray">
                    <Trans>Meeting with Alisa</Trans>
                  </p>
                  <p className="text-gray mb-0 ">
                    <Trans>Call Sarah Graves</Trans>
                  </p>
                </div>
              </div>
            </Tab>
            <Tab eventKey="CHATS" title="CHATS">
              <div>
                <div className="d-flex align-items-center justify-content-between border-bottom">
                  <p className="settings-heading border-top-0 mb-3 pl-3 pt-0 border-bottom-0 pb-0">
                    <Trans>FRIENDS</Trans>
                  </p>
                  <small className="settings-heading border-top-0 mb-3 pt-0 border-bottom-0 pb-0 pr-3 font-weight-normal">
                    <Trans>See All</Trans>
                  </small>
                </div>
                <ul className="chat-list">
                  <li className="list active">
                    <div className="profile">
                      <img
                        src={require("../../assets/images/faces/face1.jpg")}
                        alt="profile"
                      />
                      <span className="online"></span>
                    </div>
                    <div className="info">
                      <p>
                        <Trans>Thomas Douglas</Trans>
                      </p>
                      <p>
                        <Trans>Available</Trans>
                      </p>
                    </div>
                    <small className="text-muted my-auto">
                      19 <Trans>min</Trans>
                    </small>
                  </li>
                  <li className="list">
                    <div className="profile">
                      <img
                        src={require("../../assets/images/faces/face2.jpg")}
                        alt="profile"
                      />
                      <span className="offline"></span>
                    </div>
                    <div className="info">
                      <div className="wrapper d-flex">
                        <p>
                          <Trans>Catherine</Trans>
                        </p>
                      </div>
                      <p>
                        <Trans>Away</Trans>
                      </p>
                    </div>
                    <div className="badge badge-success badge-pill my-auto mx-2">
                      4
                    </div>
                    <small className="text-muted my-auto">
                      23 <Trans>min</Trans>
                    </small>
                  </li>
                  <li className="list">
                    <div className="profile">
                      <img
                        src={require("../../assets/images/faces/face3.jpg")}
                        alt="profile"
                      />
                      <span className="online"></span>
                    </div>
                    <div className="info">
                      <p>
                        <Trans>Daniel Russell</Trans>
                      </p>
                      <p>
                        <Trans>Available</Trans>
                      </p>
                    </div>
                    <small className="text-muted my-auto">14 min</small>
                  </li>
                  <li className="list">
                    <div className="profile">
                      <img
                        src={require("../../assets/images/faces/face4.jpg")}
                        alt="profile"
                      />
                      <span className="offline"></span>
                    </div>
                    <div className="info">
                      <p>
                        <Trans>James Richardson</Trans>
                      </p>
                      <p>Away</p>
                    </div>
                    <small className="text-muted my-auto">
                      2 <Trans>min</Trans>
                    </small>
                  </li>
                  <li className="list">
                    <div className="profile">
                      <img
                        src={require("../../assets/images/faces/face5.jpg")}
                        alt="profile"
                      />
                      <span className="online"></span>
                    </div>
                    <div className="info">
                      <p>
                        <Trans>Madeline Kennedy</Trans>
                      </p>
                      <p>
                        <Trans>Available</Trans>
                      </p>
                    </div>
                    <small className="text-muted my-auto">
                      5 <Trans>min</Trans>
                    </small>
                  </li>
                  <li className="list">
                    <div className="profile">
                      <img
                        src={require("../../assets/images/faces/face6.jpg")}
                        alt="profile"
                      />
                      <span className="online"></span>
                    </div>
                    <div className="info">
                      <p>
                        <Trans>Sarah Graves</Trans>
                      </p>
                      <p>
                        <Trans>Available</Trans>
                      </p>
                    </div>
                    <small className="text-muted my-auto">
                      47 <Trans>min</Trans>
                    </small>
                  </li>
                </ul>
              </div>
            </Tab>
          </Tabs>
        </div>
      </div>
    )
  }
}
const ListItem = props => {
  return (
    <li className={props.isCompleted ? "completed" : null}>
      <div className="form-check">
        <label htmlFor="" className="form-check-label">
          <input
            className="checkbox"
            type="checkbox"
            checked={props.isCompleted}
            onChange={props.changed}
          />{" "}
          {props.children} <i className="input-helper"></i>
        </label>
      </div>
      <i
        className="remove mdi mdi-close-circle-outline"
        onClick={props.remove}
      ></i>
    </li>
  )
}

export default SettingsPanel
