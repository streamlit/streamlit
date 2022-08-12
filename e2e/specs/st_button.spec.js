describe("st.button", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("shows widget correctly", () => {
    cy.get(".stButton").should("have.length", 2);

    cy.get(".stButton")
      .first()
      .matchThemedSnapshots("button-widget");
  });

  it("shows disabled widget correctly", () => {
    cy.get(".stButton").should("have.length", 2);

    cy.getIndexed(".stButton", 1).matchThemedSnapshots("disabled-button");
  });

  it("has correct default values", () => {
    cy.get(".stButton button").should("have.text", "button 1" + "button 2");
  });

  it("sets value correctly when user clicks", () => {
    cy.get(".stButton button")
      .first()
      .click();

    cy.get(".stMarkdown").contains("value: True");
    cy.get(".stMarkdown").contains("value from state: True");
  });

  it("doesn't reset the value when user clicks again", () => {
    cy.get(".stButton button")
      .first()
      .click()
      .click();

    cy.get(".stMarkdown")
      .first()
      .contains("value: True");
  });

  it("calls callback when clicked", () => {
    cy.get(".stMarkdown").contains("Button was clicked: False");

    cy.get(".stButton button")
      .first()
      .click();

    cy.get(".stMarkdown").contains("Button was clicked: True");
    cy.get(".stMarkdown").contains("times clicked: 1");
    cy.get(".stMarkdown").contains("arg value: 1");
    cy.get(".stMarkdown").contains("kwarg value: 2");

    cy.get(".stButton button")
      .first()
      .click();
    cy.get(".stMarkdown").contains("times clicked: 2");

    cy.get(".stButton button")
      .first()
      .click();
    cy.get(".stMarkdown").contains("times clicked: 3");
  });

  it("is reset when user changes another widget", () => {
    cy.get(".stButton button")
      .first()
      .click();
    cy.get(".stMarkdown").contains("value: True");
    cy.get(".stMarkdown").contains("value from state: True");
    cy.get(".stCheckbox").click();

    cy.get(".stMarkdown").contains("value: False");
    cy.get(".stMarkdown").contains("value from state: False");
  });
});
