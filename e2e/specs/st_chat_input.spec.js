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

describe("st.chat_input", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
    cy.prepForElementSnapshots();
    cy.get(".stChatInputContainer").should("have.length", 1);
  });

  it("renders the default state correctly", () => {
    cy.get(".stChatInputContainer").matchThemedSnapshots("chatInput");
  });

  it("renders the focus state correctly", () => {
    // Light Theme:
    cy.get(".stChatInputContainer textarea").click();
    cy.get(".stChatInputContainer").matchImageSnapshot("chatInput-focused-light");
    // Dark Theme:
    cy.changeTheme("Dark")
    // refocus
    cy.get(".stChatInputContainer textarea").click();
    cy.get(".stChatInputContainer").matchImageSnapshot("chatInput-focused-dark");
  });

  it("Shift+Enter creates a new line", () => {
    // Clear the text input & Shift+Enter
    cy.get(".stChatInputContainer textarea").clear().type(`{shift+enter}New Line`);
    cy.get(".stChatInputContainer").matchThemedSnapshots("chatInput-shiftEnter");
  });

  it("Enter submits/clears input", () => {
    // Types a message & then Enter
    cy.get(".stChatInputContainer textarea").clear().type(`Corgi{enter}`);
    cy.get('.stChatInputContainer textarea').invoke('val').should('eq', '');
  });

  it("can click button to submit & clear input", () => {
    // Types a message
    cy.get(".stChatInputContainer textarea").clear().type(`Corgi`);
    // Clicks the submit button
    cy.get(".stChatInputContainer button").click();
    cy.get('.stChatInputContainer textarea').invoke('val').should('eq', '');
  });

  it("grows when input text is long & shrinks when deleted", () => {
    // Type a long message (but < 200 chars)
    cy.get(".stChatInputContainer textarea").type(`Lorem ipsum dolor amet, consectetur adipiscing elit. Mauris tristique est at tincidunt pul vinar. Nam pulvinar neque sapien, eu pellentesque metus pellentesque at. Ut et dui molestie, iaculis magna.`);
    cy.get(".stChatInputContainer").matchThemedSnapshots("chatInput-grows");

    // Remove characters on third line
    cy.get(".stChatInputContainer textarea").type('{backspace}{backspace}{backspace}{backspace}{backspace}{backspace}{backspace}');
    cy.get(".stChatInputContainer").matchThemedSnapshots("chatInput-shrinks");
  });

  it("max characters enforced", () => {
    // Try to type a message over the 200 char limit
    cy.get(".stChatInputContainer textarea").clear().type(`Lorem ipsum dolor amet, consectetur adipiscing elit. Mauris tristique est at tincidunt pul vinar. Nam pulvinar neque sapien, eu pellentesque metus pellentesque at. Ut et dui molestie, iaculis magna sed. This text shouldn't appear in the input.`);
    // Check that the message is truncated
    cy.get('.stChatInputContainer textarea').invoke('val').should('eq', 'Lorem ipsum dolor amet, consectetur adipiscing elit. Mauris tristique est at tincidunt pul vinar. Nam pulvinar neque sapien, eu pellentesque metus pellentesque at. Ut et dui molestie, iaculis magna se')
    cy.get(".stChatInputContainer").matchThemedSnapshots("chatInput-maxChars");
  });
});
