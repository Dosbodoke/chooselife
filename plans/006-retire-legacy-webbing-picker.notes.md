# Retire the previous webbing model picker

Implemented October 17, 2026.

## Behavior

New registrations choose a SlackData model or manual entry. The previous Choose Life model cards, search results, selection actions, and catalog query were removed. SlackData data and photo attribution remain in the footer. Personal strength classification stays optional and separate from SlackData certification.

Existing physical webbings retain their model foreign keys, photos, specifications, lifetime recommendations where supported, and rig history. The `webbing_model` rows remain historical lookup data. Deleting those rows would clear physical webbings' model references through `webbing_model_fkey ON DELETE SET NULL`.

No database migration or data mutation is required. No automatic matching by model name was introduced. An existing webbing keeps its original source rather than receiving an unverified SlackData identity or certification. Shared registration contracts retain legacy support for older clients.

## Verification

- Expo TypeScript check passed, with incremental compilation disabled.
- ESLint passed for changed registration and picker files and both translations.
- Mobile webbing suites passed, 69 tests across 5 suites.
- Shared webbing suites passed, 32 tests across 3 suites, including legacy model specifications, lifetime and photo preservation, catalog/manual registration, and legacy registration compatibility.
- iOS Simulator displayed Green Mamba as one SlackData result with its photo, specifications, and attribution. The footer had no previous-model section.
- Selecting the SlackData model populated the draft; choosing manual entry cleared the selection and automatic label. The draft was never submitted.
- My Webbings still displayed all 3 existing webbings with photos. Existing Green Mamba retained 100 m, polyester, flat weave, 2 loops, 20 days used, and its Macaca Chita backup rig dated September 27, 2026.

## Delivery

Changes are local and uncommitted. No deployment, database mutation, R2 transfer, CI workflow, or scheduled job was performed for this task.
