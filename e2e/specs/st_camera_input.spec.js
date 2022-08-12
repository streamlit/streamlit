describe("st.camera_input", () => {
  before(() => {
    Cypress.Cookies.defaults({
      preserve: ["_xsrf"]
    });
    cy.loadApp("http://localhost:3000/");
  });

  it("displays correct number of elements", () => {
    cy.get("[data-testid='stCameraInput']").should("have.length.at.least", 2);
  });

  it("capture photo when 'Take photo' button clicked", () => {
    cy.get("[data-testid='stCameraInput']")
      .contains("Learn how to allow access.")
      .should("not.exist");

    cy.get("[data-testid='stCameraInput']")
      .should("have.length.at.least", 1)
      .should("not.be.disabled")
      .contains("Take Photo")
      .click();

    cy.get("img").should("have.length.at.least", 2);

    cy.get("[data-testid='stImage']").should("have.length.at.least", 1);
  });

  it("Remove photo when 'Clear photo' button clicked", () => {
    cy.get("[data-testid='stCameraInput']")
      .should("have.length.at.least", 2)
      .contains("Clear photo")
      .click();
    cy.get("[data-testid='stImage']").should("not.exist");
  });

  it("shows disabled widget correctly", () => {
    cy.get("[data-testid='stCameraInput']").should("have.length.at.least", 2);

    cy.getIndexed("[data-testid='stCameraInput']", 1).matchThemedSnapshots(
      "disabled-camera-input"
    );
  });
});
