## Purpose

Offering a downloadable, always-current developer kit for sale under pay-what-you-want, through a
low-friction outbound purchase flow, while preserving the site's static, no-third-party-script, and
prompt-private properties, and measuring interest without third-party tracking.

## ADDED Requirements

### Requirement: The kit stays current (launcher, not snapshot)
The kit SHALL NOT embed model prices or pricing-catalogue data. Its contents SHALL direct the user to
run the live analysis tool, so that any figures the user sees are current at the moment they run it
rather than frozen at packaging time.

#### Scenario: The packaged kit contains no catalogue data
- **WHEN** the kit's source and packaged contents are inspected
- **THEN** they contain no model prices, price constants, or copied pricing-catalogue data
- **AND** every place a live figure would appear instead invokes the live tool

### Requirement: The kit is offered from the site
The site SHALL present the kit on a dedicated, indexable page, and SHALL provide a "get the kit"
action from at least the CLI page and the site footer.

#### Scenario: The kit page is reachable and describes the kit
- **WHEN** a visitor opens the kit page
- **THEN** it describes what the kit is and offers a way to get it

#### Scenario: Entry points exist
- **WHEN** a visitor is on the CLI page or viewing the footer
- **THEN** a "get the kit" action is present and leads to the purchase flow

### Requirement: Low-friction pay-what-you-want purchase
The purchase flow SHALL let the buyer choose their price with a zero floor and an optional tip, SHALL
NOT require the buyer to create an account on this site, and SHALL be handled by an external merchant
of record that supports common low-friction payment including digital wallets and guest checkout.

#### Scenario: Buyer names their price, including zero
- **WHEN** a buyer proceeds to obtain the kit
- **THEN** they can complete with any amount including zero, with an optional higher tip
- **AND** they are not required to create an account on this site

#### Scenario: Payment, delivery and tax are external
- **WHEN** a purchase or download occurs
- **THEN** payment processing, file delivery, receipts, and sales tax are handled by the external
  merchant of record, not by this site's own infrastructure

### Requirement: No third-party script by default
The kit's purchase entry point SHALL be a plain outbound link, and the site SHALL NOT load a
third-party payment or overlay script as part of the default flow.

#### Scenario: The default entry point loads no third-party script
- **WHEN** the kit page and its actions render in the default configuration
- **THEN** no third-party payment or overlay script is loaded

### Requirement: Privacy-respecting interest measurement
Interest in the kit SHALL be measurable without third-party tracking. Any first-party measurement of
the "get the kit" action SHALL set no cookie and carry no personally identifying information.

#### Scenario: Measurement without third-party tracking
- **WHEN** the "get the kit" action is used
- **THEN** interest can be determined from the merchant of record's own reporting and, optionally, a
  first-party event that sets no cookie and carries no personally identifying information
- **AND** no third-party analytics script is involved

### Requirement: The free path stays static
Offering the kit SHALL NOT introduce a server requirement on the free path. The kit page and its
entry points SHALL function as static content.

#### Scenario: Kit offering works as static content
- **WHEN** the site is built and served as static files
- **THEN** the kit page and its "get the kit" actions function without a server
