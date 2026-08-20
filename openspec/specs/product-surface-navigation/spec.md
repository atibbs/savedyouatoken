# product-surface-navigation Specification

## Purpose
Defines how users discover and distinguish each savedyouatoken surface so they can select the right
tool without confusing package identity, operator, runtime behavior, or product availability.

## Requirements

### Requirement: Job-oriented product identity
The website SHALL identify the web analyser, CLI, runtime SDK, agent kit, and Monitor by both product
name and primary user job wherever they appear in primary navigation.

#### Scenario: Visitor scans the product navigation
- **WHEN** a visitor opens any primary product page
- **THEN** navigation labels distinguish paste-and-audit, file/CI audit, runtime observation,
  agent-operated audit, and historical monitoring

### Requirement: Dedicated runtime SDK page
The website SHALL provide an `/sdk` page that identifies `@savedyouatoken/sdk` as a separate runtime
package and explains supported providers, installation, assembled-request capture, measurement
maturity, privacy boundaries, and its relationship to the CLI.

#### Scenario: Application developer evaluates the SDK
- **WHEN** a visitor opens `/sdk`
- **THEN** they can identify the correct package and minimal integration path
- **AND** they are told that the SDK observes runtime requests while the CLI audits files

### Requirement: CLI and agent kit distinction
The `/cli` and `/kit` pages SHALL explain that both use the `savedyouatoken` CLI package but have
different operators, and SHALL state that the agent kit is not the runtime SDK.

#### Scenario: Visitor compares CLI and kit
- **WHEN** a visitor follows either product page
- **THEN** the CLI is described as human or CI operated
- **AND** the kit is described as instructions that make a coding agent invoke the live CLI

### Requirement: Consistent product chooser
Every CLI, SDK, and kit product page SHALL present the same chooser mapping common user needs to one
recommended surface and package or action.

#### Scenario: Visitor has a production runtime need
- **WHEN** a visitor selects the need to inspect dynamically assembled requests
- **THEN** the chooser directs them to the runtime SDK rather than the CLI or agent kit

### Requirement: Honest Monitor availability
The website SHALL distinguish planned or pilot Monitor functionality from currently available
products and SHALL NOT present unimplemented paid capabilities as purchasable.

#### Scenario: Monitor is not generally available
- **WHEN** a visitor opens the Monitor destination before launch
- **THEN** it is identified as a pilot or planned product
- **AND** the primary action is interest registration rather than checkout

### Requirement: Static and private product education
All product-education routes SHALL remain usable without an account, server-side prompt processing,
or transmitting prompt content.

#### Scenario: Visitor browses product pages without configuration
- **WHEN** the site is deployed without auth, database, or billing configuration
- **THEN** every product-education route renders successfully as static content
