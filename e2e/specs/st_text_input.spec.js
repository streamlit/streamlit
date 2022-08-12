describe("st.text_input", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("shows widget correctly", () => {
    cy.get(".stTextInput").should("have.length", 9);

    cy.get(".stTextInput").each((el, idx) => {
      return cy.wrap(el).matchThemedSnapshots("text_input" + idx);
    });
  });

  it("has correct default values", () => {
    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: "  "' +
        'value 2: " default text "' +
        'value 3: " 1234 "' +
        'value 4: " None "' +
        'value 5: "  "' +
        'value 6: " default text "' +
        'value 7: " default text "' +
        'value 8: " default text "' +
        'value 9: "  "' +
        "text input changed: False"
    );
  });

  it("sets value correctly when user types", () => {
    cy.get(".stTextInput input")
      .first()
      .type("test input{ctrl}{enter}");

    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: " test input "' +
        'value 2: " default text "' +
        'value 3: " 1234 "' +
        'value 4: " None "' +
        'value 5: "  "' +
        'value 6: " default text "' +
        'value 7: " default text "' +
        'value 8: " default text "' +
        'value 9: "  "' +
        "text input changed: False"
    );
  });

  it("sets value correctly on enter keypress", () => {
    cy.get(".stTextInput input")
      .first()
      .type("test input{enter}");

    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: " test input "' +
        'value 2: " default text "' +
        'value 3: " 1234 "' +
        'value 4: " None "' +
        'value 5: "  "' +
        'value 6: " default text "' +
        'value 7: " default text "' +
        'value 8: " default text "' +
        'value 9: "  "' +
        "text input changed: False"
    );
  });

  it("sets value correctly on blur", () => {
    cy.get(".stTextInput input")
      .first()
      .type("test input")
      .blur();

    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: " test input "' +
        'value 2: " default text "' +
        'value 3: " 1234 "' +
        'value 4: " None "' +
        'value 5: "  "' +
        'value 6: " default text "' +
        'value 7: " default text "' +
        'value 8: " default text "' +
        'value 9: "  "' +
        "text input changed: False"
    );
  });

  it("calls callback if one is registered", () => {
    cy.getIndexed(".stTextInput input", 8)
      .type("test input")
      .blur();

    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: "  "' +
        'value 2: " default text "' +
        'value 3: " 1234 "' +
        'value 4: " None "' +
        'value 5: "  "' +
        'value 6: " default text "' +
        'value 7: " default text "' +
        'value 8: " default text "' +
        'value 9: " test input "' +
        "text input changed: True"
    );
  });
});
