## ADDED Requirements

### Requirement: Tasks panel follows the installed rpiv-todo package
The session Tasks tab, its panel, and the header task count SHALL be shown only while the pi package `@juicesharp/rpiv-todo` is installed globally.

#### Scenario: Installed
- **WHEN** the installed package list contains `@juicesharp/rpiv-todo` (any version)
- **THEN** the Tasks tab and count are shown and the todo snapshot is derived from the session messages

#### Scenario: Not installed
- **WHEN** the installed package list does not contain `@juicesharp/rpiv-todo`
- **THEN** the Tasks tab and count are hidden and no todo snapshot is derived

#### Scenario: Installed list still loading
- **WHEN** the installed package list has not loaded yet
- **THEN** the Tasks tab is hidden

#### Scenario: Uninstalled while the Tasks tab is open
- **WHEN** the package is removed while the Tasks tab is the active work panel
- **THEN** the editor pane becomes the active work panel
