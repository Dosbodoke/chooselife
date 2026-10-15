# First growth experiment: Explore map default

Hypothesis: the illustrated Outdoors map helps visitors discover highlines more effectively than Satellite Streets.

Configured on 2026-10-14 in US project 664684. [Review the draft experiment](https://us.posthog.com/project/664684/experiments/483558). Flag 959183 is inactive. The local ignored `.env` contains the public project token and ingestion host. The public token and ingestion host are also configured and verified in the project-scoped production Expo/EAS environment. No build was published. The admin key is not stored in app configuration.

The reproducible API payload is `posthog-experiment.json`. It permits the known event names before first production ingestion because this is a new instrumentation rollout. It creates a draft with one primary and three secondary metrics; it does not launch the experiment.

## Success metrics

Choose these before launch, with one primary metric to decide the result.

| Role      | Metric              | Definition                                                                                                                                                                    |
| --------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary   | Highline discovery  | Unique exposed installations that trigger `explore_highline_opened` within 24 hours of first exposure, divided by unique exposed installations.                               |
| Secondary | Active Explore time | Sum `active_seconds` per installation over the same 24-hour window. Include zero-engagement visitors.                                                                         |
| Secondary | Seven-day return    | Exposed installations with `explore_viewed` between one and seven elapsed days after first exposure. Include only installations with a complete seven-day observation window. |
| Guardrail | Switching styles    | Unique exposed installations with `explore_map_style_changed`, divided by exposed installations. Break down by switch direction.                                              |

Longer time might indicate interest or difficulty. Prefer discovery actions for the decision; check return visits, switching, and existing Sentry crash monitoring before adopting a winner.

## Assignment and exposure

- Experiment / flag key: `explore-map-default-v1`.
- Variants: `control` = Satellite Streets, `illustrated` = Outdoors, weighted 50/50.
- Unit: anonymous installation, not account. PostHog persists its anonymous ID; the app persists the first assignment separately. Login does not rebucket it. Another device or reinstallation is a new unit.
- Existing `preferred_map_type` choices are excluded unless already enrolled. An enrolled visitor who switches styles stays in the original cohort. Analyze by assigned variant, not current style.
- Changing remote weights does not rebucket enrolled installations. New tests need new experiment keys.
- Exposure is `explore_map_experiment_exposed`, emitted after the map loads and reaches its first idle frame while Explore is focused and the app is active. Repeated visits can emit it again; count unique installations.
- Configure custom exposure, not `$feature_flag_called`. Automatic flag-call events are disabled. Experiment events include `$feature/explore-map-default-v1` with the persisted assignment.
- Explore visits reached via deep links are currently included.

## Event contract

Every event includes `experiment`, `experiment_eligible`, and `map_type`. Eligible events also include `variant` and `$feature/explore-map-default-v1`. No coordinates, search text, highline names, emails, or account IDs are added.

| Event                            | Extra properties               | Trigger                                                                          |
| -------------------------------- | ------------------------------ | -------------------------------------------------------------------------------- |
| `explore_map_experiment_exposed` | —                              | Eligible rendered map becomes visible in foreground.                             |
| `explore_viewed`                 | —                              | Visible foreground Explore visit, including excluded visitors.                   |
| `explore_engagement`             | `active_seconds`               | Non-overlapping delta every 15 seconds, at style changes, and on exit.           |
| `explore_highline_opened`        | `source`: `list` or `map_card` | Detail navigation from Explore. Measures navigation intent, not loading success. |
| `explore_map_style_changed`      | `from_map_type`, `to_map_type` | Manual style toggle.                                                             |
| `explore_visit_ended`            | —                              | Focus loss, background / inactive state, or unmount.                             |

Time starts when the rendered map is visible. Touches within Explore extend the active window. After 30 seconds without interaction, idle time is excluded. Other screens and background time are excluded. Explore includes its listing sheet, so this is not map-panning time alone. Abrupt OS termination can lose the last partial heartbeat.

## Connect and launch without paying

1. Create a PostHog Free project without adding a payment card. As checked on 2026-10-14, this includes 1M analytics events and 1M feature flag requests per month; experiments use flag requests. Usage stops at the free allowance. [Pricing](https://posthog.com/pricing).
2. Set `EXPO_PUBLIC_POSTHOG_KEY` to the public project token and `EXPO_PUBLIC_POSTHOG_HOST` to the project's ingestion host, normally `https://us.i.posthog.com` or `https://eu.i.posthog.com`. Configure the production Expo/EAS environment too. Never put a personal API key in the app.
3. Create the experiment using the exact key and variants above. Set custom exposure to `explore_map_experiment_exposed`. Exclude installations exposed to multiple variants and internal test devices.
4. Primary metric: funnel from exposure to `explore_highline_opened`, using unique installations and a 24-hour conversion window. Secondary time: mean of the sum of `active_seconds` per installation over 24 hours, including zeros. Do not average heartbeat events. Filter experiment reports to `experiment_eligible = true`.
5. Add a retention insight for the seven-day definition and a unique-installation switching funnel. Release the instrumented mobile build, confirm production event properties in Live events, then launch. Development builds never transmit analytics.
6. Use baseline conversion and weekly eligible traffic to choose a sample-size target and minimum improvement worth shipping before starting. Allow at least two full weeks plus the seven-day follow-up, and wait for sufficient statistical evidence. Low traffic can take longer. Do not stop when a daily result first looks favorable.

Replay, automatic touch/screen capture, surveys, and additional error tracking are disabled. Identity and the event queue use existing SQLite storage. Regular heartbeats add at most four events per active minute. The offline queue is capped at 200 events, so prolonged outages can lose measurements. Check usage and event delivery before drawing conclusions.

Assignment is evaluated when Explore mounts, with a maximum 1.8-second wait. Missing keys, inactive flags, unexpected variants, timeouts, and storage errors use the illustrated fallback and exclude the visit. Explicit map preferences always take precedence. Missing telemetry is not evidence of no engagement.

## Stop and adopt a result

Disable the flag to stop enrollment. At the next Explore mount or app restart, visitors receive the illustrated fallback unless they saved a manual preference. Already mounted maps finish their visit without a live style change; this is not an immediate kill switch for running sessions.

After the test, ship the winning default in code and retire the experiment. Do not assign everyone to the winner under the same experiment key, because enrollment is deliberately sticky. Preserve explicit preferences.

## Local verification

- `pnpm test features/growth --runInBand --watchman=false` checks persistence, preference exclusion, failure fallbacks, idle timing, attribution, and termination.
- Preview arms with `EXPO_PUBLIC_DEV_MAP_VARIANT=control` or `illustrated`, then restart Expo and reload. QA arms have separate storage, including manual choices, and cannot contaminate normal enrollment.
- `EXPO_PUBLIC_DEV_GROWTH_DEBUG=true` prints local event names and properties, without transmitting them. Check exposure after rendering, detail navigation, foreground timing, and original-cohort attribution after toggles.
- Remove QA overrides and restart Expo to return to the normal default.

References: [React Native SDK](https://posthog.com/docs/libraries/react-native), [experiment setup](https://posthog.com/docs/experiments/start-here), [metrics](https://posthog.com/docs/experiments/metrics).

# Second growth experiment: webbing picker layout

Hypothesis: one-column **wide cards** (stat strip and stretch curve) help people find and register their exact webbing model more often than two-column **spec tiles**. Both layouts were chosen from the October 2026 native prototypes; neither is a legacy baseline, so `control` is simply the two-column design.

Nothing has been created in PostHog yet. `webbing-picker-experiment.json` is the reproducible API payload for a draft experiment; it does not launch anything.

## Assignment and exposure

- Experiment / flag key: `webbing-picker-layout-v1`.
- Variants: `control` = spec tiles (two columns, four labelled tiles, the sorted tile inverted), `wide` = wide cards (one column, stat strip, stretch curve), weighted 50/50.
- Unit: anonymous installation, sticky like the map experiment. The first valid variant is persisted under `experiment:webbing-picker-layout-v1`; later flag changes never move an installation. Login does not rebucket.
- Assignment resolves when the registration screen mounts, with the same 1.8-second flag timeout. Until it resolves, and for missing keys, inactive flags, unexpected variants, timeouts, or storage failures, the picker shows spec tiles and events are `experiment_eligible = false`.
- The layout is locked when the sheet opens; a late assignment never changes a sheet already on screen.
- Exposure is `webbing_picker_exposed`, emitted once per sheet presentation when catalog cards first become visible (FlatList viewability, 50% visible). Offline, outage, and empty-catalog sheets are not exposures. Count unique installations.
- Configure custom exposure, not `$feature_flag_called` (automatic flag events stay disabled). Eligible events carry `$feature/webbing-picker-layout-v1`.

## Event contract

Every event includes `experiment`, `experiment_eligible`, and `layout`; eligible events also include `variant` and `$feature/webbing-picker-layout-v1`. No search text, model names, user IDs, or free text are sent. `filter` values are fixed ids (`isa-certified`, `in-production`, `material:<SlackData material>`).

| Event                           | Extra properties                                                                                                                                                                  | Trigger                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `webbing_picker_exposed`        | `result_count`                                                                                                                                                                    | Catalog cards first visible in this sheet.                               |
| `webbing_picker_sorted`         | `sort_key`, `sort_direction`                                                                                                                                                      | Sort menu choice.                                                        |
| `webbing_picker_filtered`       | `filter`, `enabled`, `filter_count`                                                                                                                                               | Filter chip toggled.                                                     |
| `webbing_picker_model_selected` | `model_source` (`catalog`/`legacy`), `position` (1-based, 0 for legacy), `sort_key`, `sort_direction`, `filter_count`, `searched`, `seconds_since_exposure` (-1 if never exposed) | Model tapped.                                                            |
| `webbing_picker_manual_chosen`  | `seconds_since_exposure`                                                                                                                                                          | "Register manually" tapped.                                              |
| `webbing_picker_closed`         | `outcome` (`catalog`/`legacy`/`manual`/`dismissed`), `exposed`, `seconds_open`, `searched`, `sorted`, `filter_count`                                                              | Sheet closes; exactly once per presentation.                             |
| `webbing_registered`            | `model_source` (`catalog`/`legacy`/`manual`), `has_photo`                                                                                                                         | The physical webbing row is created or recovered, once per registration. |

## Success metrics

| Role      | Metric               | Definition                                                                                             |
| --------- | -------------------- | ------------------------------------------------------------------------------------------------------ |
| Primary   | Catalog registration | Unique exposed installations with `webbing_registered` where `model_source = catalog` within 24 hours. |
| Secondary | Catalog pick         | Exposed installations with `webbing_picker_model_selected` (`catalog`) within 1 hour.                  |
| Secondary | Time to pick         | Mean `seconds_since_exposure` on catalog picks (≥ 0).                                                  |
| Secondary | Manual fallback      | Exposed installations with `webbing_picker_manual_chosen` within 1 hour. Lower is better.              |
| Guardrail | Any registration     | Exposed installations with `webbing_registered` (any source) within 24 hours. Must not drop.           |

Also useful outside the experiment report: `position` of catalog picks (how far people scroll), and `searched`/`sorted`/`filter_count` on `webbing_picker_closed` (how much each layout relies on search versus scanning).

Registrations are rare compared with map visits. Estimate weekly exposed installations before launching; this test may need several weeks to reach a meaningful sample. Do not stop when a daily result first looks favorable.

## Launch, stop, adopt

1. Release a build containing this instrumentation (development builds never transmit).
2. Create the draft from `webbing-picker-experiment.json`, exclude internal test accounts, confirm events in Live events, then launch.
3. Disable the flag to stop enrollment; enrolled installations keep their persisted layout until the code changes. Ship the winner in code and retire the key; never reuse `webbing-picker-layout-v1` for a new test.

## Local verification

- `pnpm test features/growth features/webbing --runInBand --watchman=false`.
- `EXPO_PUBLIC_DEV_WEBBING_PICKER_VARIANT=control` or `wide`, then restart Expo with `-c`. QA arms use separate storage and never send events.
- `EXPO_PUBLIC_DEV_GROWTH_DEBUG=true` prints events and properties to the Metro log without sending them.
