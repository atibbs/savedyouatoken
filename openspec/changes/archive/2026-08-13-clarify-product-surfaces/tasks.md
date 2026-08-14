## 1. Product taxonomy

- [x] 1.1 Inventory product names, package references, routes, navigation, metadata, and README copy
- [x] 1.2 Define a typed shared catalogue for product name, job, route, package/action, and availability
- [x] 1.3 Add unit coverage that prevents duplicate routes and inconsistent package identities

## 2. Runtime SDK destination

- [x] 2.1 Build the static `/sdk` page with the runtime-observation promise and package installation
- [x] 2.2 Add minimal OpenAI and Anthropic examples using current supported SDK APIs
- [x] 2.3 Document provisional versus mature measurement, sinks, privacy, and production safety
- [x] 2.4 Add CLI-versus-SDK guidance and links to complete package documentation

## 3. Existing surface clarification

- [x] 3.1 Update `/cli` to describe file and CI auditing and direct live-app builders to `/sdk`
- [x] 3.2 Update `/kit` to state that it is agent instructions invoking the CLI, not the runtime SDK
- [x] 3.3 Add the shared product chooser to `/sdk`, `/cli`, and `/kit`
- [x] 3.4 Update primary navigation, footer, sitemap, metadata, and README from the shared taxonomy
- [x] 3.5 Add an explicitly pre-launch Monitor destination or omit it until an interest action exists

## 4. Verification

- [x] 4.1 Add route tests for exact package names, cross-links, chooser behavior, and availability claims
- [x] 4.2 Verify every product route renders without auth, database, billing, or runtime prompt transfer
- [x] 4.3 Run typecheck, tests, and the production build and confirm product routes remain statically rendered
