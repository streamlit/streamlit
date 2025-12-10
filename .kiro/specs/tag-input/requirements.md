# Requirements Document

## Introduction

This document specifies the requirements for `st.tag_input`, a newit widget that allows users to enter multiple free-form text values displayed as removable tags (also known as chips or tokens). This widget addresses a common need in data applications for collecting multiple discrete text inputs such as email addresses, keywords, labels, or filter criteria. The widget provides a user-friendly interface similar to email recipient fields in Gmail or label selectors in GitHub.

## Glossary

- **Tag**: A discrete text value displayed as a visual chip/pill element that can be removed by the user
- **Tag Input Widget**: The complete UI component including the text input field and the collection of tags
- **Delimiter**: A character or key press that triggers the creation of a new tag from the current input text
- **Suggestion**: An optional autocomplete suggestion shown to the user based on predefined options
- **Tag Input System**: The backend and frontend components that implement the tag input functionality

## Requirements

### Requirement 1

**User Story:** As a developer, I want to add a tag input widget to my Streamlit app, so that users can enter multiple text values in a single input field.

#### Acceptance Criteria

1. WHEN a developer calls `st.tag_input()` with a label THEN the Tag Input System SHALL render a labeled input field capable of accepting multiple text values
2. WHEN the Tag Input System renders THEN the Tag Input System SHALL display any existing tags as removable pill-shaped elements above or beside the input field
3. WHEN a developer provides a `value` parameter THEN the Tag Input System SHALL initialize the widget with those tags displayed
4. WHEN a developer provides a `key` parameter THEN the Tag Input System SHALL use that key for widget state management

### Requirement 2

**User Story:** As a user, I want to add tags by typing and pressing Enter or a delimiter, so that I can quickly enter multiple values.

#### Acceptance Criteria

1. WHEN a user types text and presses Enter THEN the Tag Input System SHALL create a new tag from the trimmed input text and clear the input field
2. WHEN a user types text and presses Tab THEN the Tag Input System SHALL create a new tag from the trimmed input text and clear the input field
3. WHEN a user types a comma followed by text THEN the Tag Input System SHALL create a new tag from the text before the comma
4. WHEN a user attempts to add a tag with only whitespace THEN the Tag Input System SHALL reject the tag and maintain the current state
5. WHEN a user pastes text containing delimiters THEN the Tag Input System SHALL split the text and create multiple tags

### Requirement 3

**User Story:** As a user, I want to remove tags I've added, so that I can correct mistakes or change my selections.

#### Acceptance Criteria

1. WHEN a user clicks the remove button on a tag THEN the Tag Input System SHALL remove that tag from the list
2. WHEN a user presses Backspace with an empty input field THEN the Tag Input System SHALL remove the last tag in the list
3. WHEN a tag is removed THEN the Tag Input System SHALL update the widget value and trigger any registered callbacks

### Requirement 4

**User Story:** As a developer, I want to limit the number of tags users can enter, so that I can enforce application constraints.

#### Acceptance Criteria

1. WHEN a developer provides a `max_tags` parameter THEN the Tag Input System SHALL prevent users from adding more than the specified number of tags
2. WHEN the maximum tag limit is reached THEN the Tag Input System SHALL disable the input field or display a visual indicator
3. WHEN a tag is removed after reaching the limit THEN the Tag Input System SHALL re-enable tag input

### Requirement 5

**User Story:** As a developer, I want to provide autocomplete suggestions, so that users can select from predefined options while still allowing free-form input.

#### Acceptance Criteria

1. WHEN a developer provides an `options` parameter THEN the Tag Input System SHALL display matching suggestions as the user types
2. WHEN a user selects a suggestion THEN the Tag Input System SHALL add it as a tag and clear the input field
3. WHEN a user types text not in the options list THEN the Tag Input System SHALL allow the free-form text to be added as a tag
4. WHEN suggestions are displayed THEN the Tag Input System SHALL allow keyboard navigation using arrow keys

### Requirement 6

**User Story:** As a developer, I want to validate tags before they are added, so that I can ensure data quality.

#### Acceptance Criteria

1. WHEN a developer provides a `validate` callback THEN the Tag Input System SHALL call this function before adding each tag
2. WHEN the validate callback returns False THEN the Tag Input System SHALL reject the tag and not add it to the list
3. WHEN a tag is rejected due to validation THEN the Tag Input System SHALL provide visual feedback to the user

### Requirement 7

**User Story:** As a developer, I want to prevent duplicate tags, so that users don't accidentally enter the same value twice.

#### Acceptance Criteria

1. WHEN a user attempts to add a tag that already exists THEN the Tag Input System SHALL reject the duplicate tag by default
2. WHEN a developer sets `allow_duplicates=True` THEN the Tag Input System SHALL permit duplicate tag values
3. WHEN a duplicate tag is rejected THEN the Tag Input System SHALL highlight the existing tag briefly to indicate the duplicate

### Requirement 8

**User Story:** As a developer, I want the tag input to be accessible, so that all users can interact with it effectively.

#### Acceptance Criteria

1. WHEN the widget renders THEN the Tag Input System SHALL include appropriate ARIA labels and roles for screen readers
2. WHEN a user navigates with keyboard THEN the Tag Input System SHALL support full keyboard interaction including tag removal
3. WHEN tags are added or removed THEN the Tag Input System SHALL announce changes to assistive technologies

### Requirement 9

**User Story:** As a developer, I want to customize the appearance of the tag input, so that it fits my application's design.

#### Acceptance Criteria

1. WHEN a developer provides a `placeholder` parameter THEN the Tag Input System SHALL display that text when the input is empty
2. WHEN a developer provides a `disabled` parameter set to True THEN the Tag Input System SHALL render in a disabled state preventing all interaction
3. WHEN a developer provides a `label_visibility` parameter THEN the Tag Input System SHALL show, hide, or collapse the label accordingly
4. WHEN a developer provides a `help` parameter THEN the Tag Input System SHALL display a tooltip with the help text

### Requirement 10

**User Story:** As a developer, I want to respond to tag changes, so that I can update my application state accordingly.

#### Acceptance Criteria

1. WHEN a developer provides an `on_change` callback THEN the Tag Input System SHALL invoke it whenever tags are added or removed
2. WHEN the widget value changes THEN the Tag Input System SHALL return the updated list of tags
3. WHEN the widget is used in a form THEN the Tag Input System SHALL integrate with Streamlit's form submission mechanism

### Requirement 11

**User Story:** As a developer, I want to serialize and deserialize tag values, so that the widget state persists correctly.

#### Acceptance Criteria

1. WHEN tags are serialized for transmission THEN the Tag Input System SHALL convert the tag list to a format compatible with Protocol Buffers
2. WHEN tags are deserialized from the frontend THEN the Tag Input System SHALL reconstruct the original list of string values
3. WHEN serializing then deserializing a list of tags THEN the Tag Input System SHALL produce an equivalent list (round-trip property)
