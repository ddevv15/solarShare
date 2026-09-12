# SolarShare development blueprint

## Purpose

This is the working document for building SolarShare. It describes the product, system design, data model, APIs, algorithms, screens, testing plan, and implementation order.

The submission report explains the idea to judges. This document is for development and can change as the prototype takes shape.

## 1. What we are building

SolarShare is a neighbourhood marketplace for peer-to-peer solar energy credits.

A household with rooftop solar can offer expected surplus to other households in the same community. Buyers reserve that energy for a defined time interval. SolarShare forecasts supply, matches it with demand, calculates a price inside configured tariff limits, and settles the trade against final meter readings.

The prototype will use public weather data, modeled PV generation, and simulated household readings. If a customer provides inverter or smart meter data, SolarShare can import it and use it instead of the modeled values. Later, the same ingestion layer can connect directly to approved device APIs.

SolarShare records energy and financial settlement. It does not physically route a particular unit of electricity between two homes.

## 2. Agreed language

- **Community:** A group of users allowed to trade with each other. In the prototype this is a configured neighbourhood. In production it should come from an approved utility service area or feeder mapping.
- **Prosumer:** A household that has rooftop solar and can act as a seller. The same account may also act as a buyer.
- **Offer:** A quantity of forecast surplus made available for one or more 15-minute market intervals.
- **Reservation:** A buyer's request for energy, maximum price, and applicable intervals.
- **Allocation:** The part of an offer assigned to a reservation by the matching engine.
- **Settlement:** The final energy and credit calculation after actual or simulated readings are available.
- **Real data:** Public weather or grid data, plus customer-authorized meter or inverter data when available.
- **Modeled data:** PV generation or household demand calculated from known inputs.
- **Simulated data:** Generated household, meter, or feeder readings used to run the prototype.
- **Congestion:** A feeder-load signal from 0 to 1. The prototype simulates it. A production system would receive it from a utility or approved operator.

## 3. Decisions already made

| Area | Decision |
| --- | --- |
| Product | One responsive web application with seller, buyer, and operator views. |
| Framework | Next.js with TypeScript. |
| Styling | Tailwind CSS and shadcn/ui. |
| Backend | Next.js server routes and services. Split services later only if scale requires it. |
| Database | Supabase PostgreSQL. |
| Authentication | Supabase Auth with email and password. Include seeded judge accounts. |
| Authorization | Row Level Security plus role and community checks on the server. |
| Live updates | Supabase Realtime for offers, reservations, allocations, and settlements. |
| Weather | Open-Meteo. |
| PV estimate | PVGIS as the main modeled source. Open-Meteo can adjust short-term conditions. |
| Household telemetry | Customer-authorized inverter or meter data takes priority when present. |
| Fallback data | Stored sample responses and simulated readings. |
| Time resolution | 15-minute market and meter intervals. |
| Maps | Leaflet with an OpenStreetMap-compatible tile layer. Use a geocoding adapter rather than tying the app to one provider. |
| Location privacy | Show approximate household pins. Community membership must not rely only on straight-line distance. |
| Import and export | CSV import for readings. CSV export for forecasts, offers, reservations, settlements, and impact results. |
| Pricing | Deterministic and explainable. Price stays inside feed-in and retail tariff limits. |
| Auto-adjust | The app can suggest a revised price. It changes a user's limit only when Auto Adjust is enabled. |
| Payments | Energy credits only in the prototype. No real payment gateway. |
| Ledger | Append-only database records. No blockchain in the first version. |

## 4. Assumptions to keep configurable

These are development defaults, not permanent product rules.

- Currency is INR.
- Energy is stored in kWh.
- Power is stored in kW.
- Market intervals are 15 minutes.
- One seeded community contains one modeled solar home and four simulated buyers.
- Feed-in and retail tariffs are set in an operator configuration screen.
- A user can belong to one community in the prototype. The schema should allow more than one later.
- Community and feeder membership are assigned by seed data or an operator. The map is for orientation, not network verification.
- The first version uses next-day offers with intraday refreshes.

## 5. Prototype scope

### Build now

- Sign up, sign in, sign out, and seeded judge accounts.
- User profile, location, and role selection.
- Community map with approximate seller and buyer pins.
- Solar asset setup with system capacity, tilt, azimuth, and optional reserve settings.
- Public weather and PV estimate retrieval.
- Generation and household-demand simulation.
- CSV reading import with validation and preview.
- Guided Sharing for sellers.
- Manual offer entry as a secondary path.
- Buyer reservation flow and optional Green Saver settings.
- Price suggestions, Auto Adjust opt-in, and manual price limits.
- Interval matching and allocation.
- Settlement against imported or simulated readings.
- CSV export.
- Operator view for tariffs, feeder state, market activity, and audit history.
- Data-source labels on all forecasts and readings.

### Do not build now

- Real money transfer.
- Utility billing integration.
- Live control of an inverter, battery, or smart meter.
- Regulatory settlement or energy certificates.
- Blockchain or smart contracts.
- Native mobile applications.
- Verification that two addresses share a physical feeder.
- A machine-learning forecast that requires training data.

## 6. User roles and permissions

### Household user

A household user can switch between seller and buyer views. Selling controls appear only after the user creates a solar asset.

The user can:

- Maintain a profile and approximate map location.
- Configure a solar asset and household reserve.
- Import or export CSV files.
- Review forecasts and data sources.
- Approve, edit, pause, or cancel an offer.
- Reserve available solar.
- Set a maximum buyer price or enable Green Saver.
- Review allocations, settlements, savings, and credits.

### Operator

The operator can:

- Create a community and manage memberships.
- Configure feed-in and retail tariff assumptions.
- Set or simulate feeder capacity and load.
- Review active offers, reservations, and settlements.
- Inspect data-source and audit records.
- Pause a market interval if the scenario requires it.

### Service role

Background jobs use a server-only service role to:

- Refresh weather and PV forecasts.
- Produce simulated readings.
- Recalculate price suggestions.
- Run matching and settlement.

The service-role secret must never be available in the browser.

## 7. Main user flows

### 7.1 First-time setup

1. The user creates an account.
2. The app asks for a display name and approximate location.
3. The user joins a community with a code or seeded membership.
4. A solar owner adds panel capacity and installation details.
5. The user chooses a data source: model, CSV import, or future device connection.
6. The dashboard explains whether each value is public, modeled, simulated, or imported.

### 7.2 Guided Sharing

1. SolarShare retrieves the weather and PV estimate.
2. It forecasts household demand.
3. It subtracts demand and the household reserve from expected generation.
4. The seller receives a plain suggestion such as: "You may have 4 kWh available tomorrow from 1 PM to 3 PM."
5. The seller approves, edits, or declines the suggestion.
6. Approved intervals become an offer.
7. Buyer reservations and the matching result update live.

### 7.3 Buyer reservation

1. The buyer opens the community marketplace.
2. The app shows available intervals, estimated savings, and data-source labels.
3. The buyer chooses an amount or accepts the suggested amount.
4. The buyer sets a maximum price or accepts the current price.
5. SolarShare confirms the reservation and updates its allocation status live.
6. The buyer receives a final settlement after the interval closes.

### 7.4 Suggested price revision

1. An offer remains partly unmatched as its interval approaches.
2. The pricing service calculates a new suggested price.
3. The seller sees the reason: excess supply, higher demand, or feeder congestion.
4. The seller can accept the suggestion.
5. If Auto Adjust is enabled, SolarShare may update the offer within the seller's configured limit.

### 7.5 Settlement

1. SolarShare obtains imported, connected, or simulated final readings.
2. It calculates the seller's final surplus after household demand and reserve.
3. It reduces allocations proportionally if delivered surplus is lower than reserved energy.
4. It calculates buyer cost and seller credit.
5. It writes immutable settlement and ledger records.
6. It updates savings and impact results.

## 8. Screens and navigation

### Public screens

- Landing page with a short explanation.
- Sign in and sign up.
- Demo account chooser.

### Shared household screens

- Home dashboard.
- Community map.
- Marketplace.
- Activity and settlement history.
- Import and export centre.
- Profile and preferences.

### Seller screens

- Solar asset setup.
- Forecast and expected surplus.
- Guided Sharing review.
- Manual offer form.
- Active offer detail.
- Seller credits and exported energy.

### Buyer screens

- Available local solar.
- Reservation review.
- Active reservation detail.
- Green Saver settings.
- Buyer savings and settled energy.

### Operator screens

- Community overview.
- Tariff configuration.
- Feeder scenario control.
- Active market intervals.
- Settlement audit.
- Data health and import failures.

## 9. Recommended information architecture

    SolarShare
    |- Dashboard
    |- Marketplace
    |  |- Available solar
    |  |- My offers
    |  `- My reservations
    |- Energy
    |  |- Solar asset
    |  |- Forecast
    |  |- Readings
    |  `- Import / export
    |- Community
    |  |- Map
    |  `- Activity
    `- Account
       |- Profile
       |- Automation limits
       `- Data connections

    Operator
    |- Overview
    |- Community members
    |- Tariffs
    |- Feeder scenario
    |- Market intervals
    `- Audit log

## 10. System architecture

    Browser
      |
      v
    Next.js web application
      |
      +--> Supabase Auth
      +--> Next.js server routes
              |
              +--> PostgreSQL and Realtime
              +--> Forecast service
              +--> Pricing service
              +--> Matching service
              +--> Settlement service
              +--> Import and export service
              |
              +--> Open-Meteo adapter
              +--> PVGIS adapter
              +--> Geocoding adapter
              +--> Future device adapters

External providers must sit behind small TypeScript interfaces. Page components should call application services, not provider URLs. This keeps tests simple and allows a provider to be replaced.

Suggested interfaces:

    interface GenerationDataProvider {
      getIntervals(input: GenerationRequest): Promise<GenerationInterval[]>;
    }

    interface ReadingProvider {
      getReadings(input: ReadingRequest): Promise<EnergyReading[]>;
    }

    interface GeocodingProvider {
      search(query: string): Promise<ApproximateLocation[]>;
    }

## 11. Suggested repository structure

    solarshare/
    |- app/
    |  |- (auth)/
    |  |- dashboard/
    |  |- marketplace/
    |  |- energy/
    |  |- community/
    |  |- operator/
    |  `- api/
    |- components/
    |  |- ui/
    |  |- marketplace/
    |  |- energy/
    |  `- maps/
    |- lib/
    |  |- auth/
    |  |- db/
    |  |- validation/
    |  `- units/
    |- services/
    |  |- providers/
    |  |- forecasting/
    |  |- pricing/
    |  |- matching/
    |  |- settlement/
    |  `- simulation/
    |- supabase/
    |  |- migrations/
    |  |- seed.sql
    |  `- policies/
    |- tests/
    |  |- unit/
    |  |- integration/
    |  `- e2e/
    |- docs/
    `- public/

## 12. Data-source precedence

SolarShare chooses data per household and interval in this order:

1. Valid customer-authorized inverter or smart meter data.
2. Valid CSV-imported readings.
3. PVGIS and Open-Meteo modeled values.
4. Stored sample values when an external service is unavailable.
5. Simulator output for demo-only household or feeder data.

Every stored interval must include:

- Source type.
- Provider or import-job identifier.
- Time of retrieval.
- Quality state.
- Original unit.
- Normalized value.
- Whether the value is measured, modeled, or simulated.

Do not overwrite one source with another. Store the readings separately and let a source-selection service choose the preferred value. This preserves the audit trail.

## 13. CSV import and export

### 13.1 Reading import format

Required columns:

| Column | Example | Rule |
| --- | --- | --- |
| timestamp | 2026-09-12T13:00:00+05:30 | ISO 8601 with timezone. |
| interval_minutes | 15 | Must match a supported interval. |
| metric | generation | generation, consumption, grid_import, or grid_export. |
| value | 0.82 | Non-negative decimal. |
| unit | kWh | Accept kWh, Wh, kW, or W and normalize. |

Optional columns:

| Column | Example | Use |
| --- | --- | --- |
| device_id | inverter-home-01 | Links readings to a data connection. |
| quality | measured | measured, estimated, corrected, or missing. |
| timezone | Asia/Kolkata | Used when the timestamp has no offset. |

### 13.2 Import pipeline

1. Upload the file to a private temporary storage path.
2. Parse the header and sample rows.
3. Map columns if the file does not use the standard names.
4. Normalize timestamps to UTC and values to kWh per interval.
5. Validate duplicates, gaps, negative readings, unsupported units, and unrealistic spikes.
6. Show a preview with accepted rows, warnings, and rejected rows.
7. Commit only after the user confirms.
8. Store the original file hash and import summary.
9. Delete the temporary source file unless retention is explicitly enabled.

### 13.3 Export options

- Forecast intervals.
- Raw and selected readings.
- Offers and reservations.
- Allocations and settlements.
- Seller credits and buyer savings.
- Operator market summary.

Exports should include the timezone, unit, source type, and generated-at timestamp.

## 14. Map and location design

Use Leaflet in the client. Keep the provider behind a map component so the tile source can change.

The map should show:

- The community boundary or approximate service area.
- Rounded household locations rather than exact addresses.
- Seller availability by area.
- Current or upcoming sharing intervals.
- A marker legend for sellers, buyers, and the operator's feeder point.

Privacy rules:

- Round latitude and longitude before sending household locations to the browser.
- Do not include a full address in map popups.
- Do not expose another user's profile identifier in map payloads.
- Geocoding results are suggestions. Community access still comes from membership records.
- Rate-limit search and cache approved results.

Before implementation, verify the current usage policies for the chosen geocoder and tile server. Public OpenStreetMap infrastructure should not be treated as an unlimited production service.

## 15. Database model

Use UUID primary keys, UTC timestamps, and explicit community identifiers on market tables. Store energy as decimal kWh values. Do not use floating-point arithmetic for prices or settlement.

### 15.1 Identity and community

#### profiles

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Matches the Supabase Auth user ID. |
| display_name | text | User-facing name. |
| default_role | enum | household or operator. |
| latitude_approx | numeric | Rounded before storage or display. |
| longitude_approx | numeric | Rounded before storage or display. |
| timezone | text | Default Asia/Kolkata. |
| created_at | timestamptz | Audit field. |

#### communities

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| name | text | Display name. |
| join_code | text | Prototype membership flow. |
| timezone | text | Used to build intervals. |
| currency | text | INR by default. |
| status | enum | active, paused, archived. |

#### community_members

| Field | Type | Notes |
| --- | --- | --- |
| community_id | uuid | Foreign key. |
| user_id | uuid | Foreign key. |
| member_role | enum | household or operator. |
| status | enum | invited, active, suspended. |
| joined_at | timestamptz | Audit field. |

Create a unique index on community_id and user_id.

### 15.2 Energy assets and connections

#### energy_assets

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| owner_id | uuid | Household owner. |
| community_id | uuid | Trading community. |
| asset_type | enum | solar, battery, meter. |
| capacity_kw | numeric | Solar array rating. |
| tilt_degrees | numeric | 0 to 90. |
| azimuth_degrees | numeric | Use one documented convention. |
| reserve_kwh | numeric | Protected household reserve. |
| metadata | jsonb | Provider-neutral extra fields. |

#### data_connections

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| asset_id | uuid | Linked asset. |
| connection_type | enum | model, csv, inverter_api, meter_api, simulator. |
| provider | text | pvgis, open_meteo, sunspec, vendor name, or simulator. |
| status | enum | pending, active, error, revoked. |
| credentials_ref | text | Reference to a secret, never the secret itself. |
| last_sync_at | timestamptz | Health check. |

#### import_jobs

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| user_id | uuid | Import owner. |
| asset_id | uuid | Target asset. |
| file_hash | text | Duplicate detection. |
| status | enum | uploaded, validated, committed, failed. |
| accepted_rows | integer | Summary. |
| rejected_rows | integer | Summary. |
| warnings | jsonb | Validation results. |

### 15.3 Interval data

#### energy_readings

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| asset_id | uuid | Source asset. |
| interval_start | timestamptz | Inclusive. |
| interval_end | timestamptz | Exclusive. |
| metric | enum | generation, consumption, grid_import, grid_export. |
| value_kwh | numeric | Normalized interval energy. |
| source_type | enum | connected, imported, modeled, simulated. |
| quality | enum | measured, estimated, corrected, missing. |
| source_ref | text | Provider response, import, or simulation identifier. |

Create an index on asset_id, metric, and interval_start.

#### forecasts

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| asset_id | uuid | Forecast target. |
| interval_start | timestamptz | Market interval. |
| generation_kwh | numeric | Expected generation. |
| consumption_kwh | numeric | Expected home use. |
| reserve_kwh | numeric | Protected amount. |
| surplus_kwh | numeric | Available offer quantity. |
| confidence_low_kwh | numeric | Optional range. |
| confidence_high_kwh | numeric | Optional range. |
| source_summary | jsonb | Inputs and model version. |
| created_at | timestamptz | Forecast issue time. |

Do not overwrite old forecasts. New forecasts create new rows so forecast error can be measured later.

### 15.4 Market records

#### tariff_configs

| Field | Type | Notes |
| --- | --- | --- |
| community_id | uuid | One active configuration per effective period. |
| feed_in_rate | numeric | INR per kWh. |
| retail_rate | numeric | INR per kWh. |
| seller_margin_ratio | numeric | Optional minimum improvement. |
| buyer_discount_ratio | numeric | Optional minimum saving. |
| effective_from | timestamptz | Version boundary. |

#### feeder_snapshots

| Field | Type | Notes |
| --- | --- | --- |
| community_id | uuid | Linked community. |
| interval_start | timestamptz | Market interval. |
| capacity_kw | numeric | Scenario or connected value. |
| load_kw | numeric | Scenario or connected value. |
| congestion_ratio | numeric | load_kw divided by capacity_kw, clamped for UI use. |
| source_type | enum | simulated or connected. |

#### offers

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| seller_id | uuid | Household user. |
| asset_id | uuid | Solar asset. |
| community_id | uuid | Match boundary. |
| interval_start | timestamptz | 15-minute interval. |
| quantity_kwh | numeric | Offered amount. |
| remaining_kwh | numeric | Unallocated amount. |
| minimum_price | numeric | Optional seller limit. |
| current_price | numeric | Current market suggestion. |
| auto_adjust | boolean | Allows movement inside seller limit. |
| status | enum | draft, open, partly_matched, matched, closed, cancelled. |

#### reservations

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| buyer_id | uuid | Household user. |
| community_id | uuid | Match boundary. |
| interval_start | timestamptz | 15-minute interval. |
| quantity_kwh | numeric | Requested amount. |
| remaining_kwh | numeric | Unallocated amount. |
| maximum_price | numeric | Optional buyer limit. |
| auto_adjust | boolean | Allows movement inside buyer limit. |
| status | enum | pending, active, partly_matched, matched, closed, cancelled. |

#### allocations

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| offer_id | uuid | Matched offer. |
| reservation_id | uuid | Matched demand. |
| interval_start | timestamptz | Settlement interval. |
| allocated_kwh | numeric | Reserved quantity. |
| unit_price | numeric | Locked allocation price. |
| pricing_version | text | Algorithm version. |
| status | enum | allocated, reduced, settled, cancelled. |

#### settlements

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| allocation_id | uuid | One settlement per allocation. |
| delivered_kwh | numeric | Final energy. |
| unit_price | numeric | Applied price. |
| buyer_debit | numeric | Simulated credit debit. |
| seller_credit | numeric | Simulated credit amount. |
| input_source | enum | connected, imported, modeled, simulated. |
| settled_at | timestamptz | Completion time. |

#### ledger_entries

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key. |
| settlement_id | uuid | Source settlement. |
| account_id | uuid | Buyer or seller. |
| entry_type | enum | debit or credit. |
| amount | numeric | INR-denominated prototype credit. |
| previous_hash | text | Optional append-only chain. |
| entry_hash | text | Detects accidental modification. |
| created_at | timestamptz | Audit time. |

## 16. Forecasting design

The forecast service produces one row per 15-minute interval. Keep the first version rule-based and traceable.

### 16.1 Solar generation inputs

- Latitude and longitude.
- System capacity in kW.
- Panel tilt.
- Panel azimuth.
- Weather or solar-radiation data.
- A configurable performance ratio for system losses.
- Recent measured or imported generation when available.

PVGIS provides the baseline PV estimate. Open-Meteo can supply current and forecast weather values. The later research document will verify the exact fields, orientation convention, tilt assumptions, and method used to adjust the PVGIS baseline.

For a transparent fallback model:

    interval_generation_kwh =
      system_capacity_kw
      * plane_of_array_irradiance_kwh_per_m2
      * performance_ratio

The irradiance term must be normalized to the standard test irradiance used by the model. Do not ship this formula until the research step confirms the unit conversion.

### 16.2 Household-demand forecast

Use the best available source:

1. Recent connected or imported consumption for the same time of day.
2. A rolling average of available historical intervals.
3. A seeded household profile for simulated users.

The prototype does not need a trained machine-learning model. A rolling average plus weekday and weekend profiles is easier to explain.

### 16.3 Surplus calculation

For each interval:

    protected_home_energy =
      expected_consumption_kwh
      + reserve_for_interval_kwh

    forecast_surplus_kwh
      = max(0, expected_generation_kwh - protected_home_energy)

Apply a safety factor before suggesting an offer:

    suggested_offer_kwh
      = forecast_surplus_kwh * forecast_safety_factor

Use a configurable safety factor. A conservative starting value can be tested with simulation, but it should not be treated as a permanent product constant.

### 16.4 Source override

If valid inverter data is available for a future interval, use the vendor's forecast only when its meaning and units are documented. Historical inverter readings can improve the baseline but do not automatically provide a forecast.

For completed intervals, measured or imported readings take priority over modeled values during settlement.

### 16.5 Forecast output shown to users

The seller should see:

- Expected generation.
- Expected home use.
- Protected reserve.
- Suggested shareable energy.
- Time window.
- Data source.
- Last updated time.
- A simple confidence label.

Do not show the full calculation by default. Put it behind a "How was this calculated?" action.

## 17. Pricing engine

The price engine must be bounded, deterministic, and versioned. Given the same inputs and configuration, it must return the same price and explanation.

### 17.1 Inputs

For each interval:

- Feed-in tariff F.
- Retail tariff R.
- Available local supply S in kWh.
- Active local demand D in kWh.
- Congestion ratio C from 0 to 1.
- Seller minimum price.
- Buyer maximum price.
- Auto Adjust settings.

Require F to be lower than R. If the tariff configuration is invalid, pause the interval rather than guessing.

### 17.2 Price corridor

Create a small benefit margin on both sides:

    market_floor = F + seller_margin
    market_ceiling = R - buyer_discount

The operator configures seller_margin and buyer_discount. If the floor is greater than the ceiling, the market interval cannot open.

### 17.3 Demand pressure

Use a bounded ratio:

    demand_pressure =
      clamp((D - S) / max(D, S, epsilon), -1, 1)

Interpretation:

- A value near -1 means supply is much higher than demand.
- A value near 0 means supply and demand are close.
- A value near 1 means demand is much higher than supply.

### 17.4 Congestion adjustment

Define an operator-set warning level C_warning. Congestion has no adjustment below that point.

    congestion_pressure =
      clamp((C - C_warning) / (1 - C_warning), 0, 1)

Only apply the positive congestion adjustment when local solar is expected to reduce grid import. If the feeder scenario represents export congestion, the response may be different and must be handled as a separate rule later.

### 17.5 Initial price formula

Use the centre of the market corridor as the base:

    midpoint = (market_floor + market_ceiling) / 2

    raw_price =
      midpoint
      + corridor_width * demand_weight * demand_pressure
      + corridor_width * congestion_weight * congestion_pressure

    suggested_price =
      clamp(raw_price, market_floor, market_ceiling)

Keep demand_weight and congestion_weight in configuration. The research document will propose starting values and test them against sample scenarios.

### 17.6 User limits

For a specific seller and buyer:

    effective_floor = max(market_floor, seller_minimum_price)
    effective_ceiling = min(market_ceiling, buyer_maximum_price)

If effective_floor is greater than effective_ceiling, the offer and reservation do not match.

If they overlap:

    allocation_price =
      clamp(suggested_price, effective_floor, effective_ceiling)

The allocation stores the exact price and pricing-version identifier. Later price changes do not modify an existing allocation.

### 17.7 Price suggestions and Auto Adjust

- Recalculate suggestions when supply, demand, or feeder conditions change.
- Show the reason for the change in plain language.
- Do not change a user's minimum or maximum price unless Auto Adjust has been enabled.
- Keep Auto Adjust inside the user's configured limit.
- Let the user disable it immediately.

Examples of explanation text:

- "More local solar is available than buyers currently need."
- "Demand is higher for this interval."
- "Local solar can reduce grid import while the feeder is busy."

## 18. Matching engine

Run matching independently for each community and 15-minute interval.

### 18.1 Eligibility rules

An offer and reservation are eligible when:

- They belong to the same active community.
- They cover the same interval.
- Both have remaining energy.
- Neither has expired or been cancelled.
- Their effective price ranges overlap.
- The market interval is open.

### 18.2 Allocation approach

For the prototype:

1. Group eligible offers and reservations by community and interval.
2. Calculate the interval's suggested price.
3. Filter pairs whose price limits do not overlap.
4. Sort reservations by maximum price, then creation time.
5. Sort offers by minimum price, then creation time.
6. Allocate energy until supply or demand is exhausted.
7. Store each allocation and update remaining quantities in one database transaction.
8. Publish the changes through Supabase Realtime.

When the final available supply is lower than the allocated supply, reduce allocations proportionally. Use deterministic rounding and assign any final remainder to the earliest allocation.

### 18.3 Concurrency

Two matching jobs must not allocate the same energy.

Use one of these database controls:

- A PostgreSQL advisory lock per community and interval.
- A transaction that locks open offer and reservation rows with SELECT FOR UPDATE.

Do not implement matching as unrelated client requests that update remaining quantities independently.

### 18.4 Idempotency

Every matching run receives an idempotency key. Re-running the same job must not create duplicate allocations.

## 19. Settlement engine

Settlement runs after an interval closes and final readings pass validation.

### 19.1 Final seller surplus

    final_surplus_kwh =
      max(
        0,
        final_generation_kwh
        - final_consumption_kwh
        - protected_reserve_kwh
      )

The prototype uses simulated or imported readings. A production version would require an approved settlement source.

### 19.2 Allocation correction

If final surplus covers all allocations, settle each allocation at its allocated quantity.

If final surplus is lower:

    delivery_ratio =
      final_surplus_kwh / total_allocated_kwh

    delivered_for_allocation =
      allocated_kwh * delivery_ratio

Apply a consistent decimal scale and rounding policy.

### 19.3 Credit calculation

    buyer_debit = delivered_kwh * allocation_price
    seller_credit = buyer_debit

The prototype does not move money. These values are ledger credits used to demonstrate settlement.

### 19.4 Settlement transaction

In one database transaction:

1. Lock the interval's unsettled allocations.
2. Load the selected final readings.
3. Calculate final surplus and delivery ratio.
4. Create settlement rows.
5. Create equal debit and credit ledger entries.
6. Mark allocations as settled or reduced.
7. Close the offer and reservation when nothing remains.
8. Write an audit event.

## 20. Feeder congestion model

The prototype operator controls:

- Feeder capacity in kW.
- Current or forecast load in kW.
- A warning ratio.
- A scenario label such as normal, busy, or constrained.

Calculate:

    congestion_ratio = load_kw / capacity_kw

The UI can clamp the displayed value, but the stored raw ratio may exceed 1.

The pricing engine uses the congestion ratio only after the warning threshold. The matching engine can also prioritize intervals where local solar reduces grid import.

Keep import congestion and export congestion separate in the schema or rule metadata. Rooftop solar may help one condition and worsen the other. The first demonstration should use import congestion because its expected response is easier to explain.

## 21. API design

Use JSON for application endpoints. Validate all input with shared schemas.

### Profile and community

| Method | Route | Purpose |
| --- | --- | --- |
| GET | /api/me | Current profile, memberships, and capabilities. |
| PATCH | /api/me | Update display name, approximate location, and preferences. |
| GET | /api/communities/:id | Community summary. |
| POST | /api/communities/join | Join with a valid code. |
| GET | /api/communities/:id/map | Privacy-safe map features. |

### Assets, readings, and forecasts

| Method | Route | Purpose |
| --- | --- | --- |
| POST | /api/assets | Create a solar or meter asset. |
| PATCH | /api/assets/:id | Update capacity, orientation, or reserve. |
| GET | /api/assets/:id/readings | Query normalized readings. |
| POST | /api/imports | Upload and start CSV validation. |
| GET | /api/imports/:id | Read preview and validation result. |
| POST | /api/imports/:id/commit | Commit accepted rows. |
| GET | /api/exports | Generate a selected CSV export. |
| GET | /api/assets/:id/forecast | Get the current forecast and source details. |
| POST | /api/assets/:id/forecast/refresh | Refresh within rate limits. |

### Marketplace

| Method | Route | Purpose |
| --- | --- | --- |
| GET | /api/market | Available intervals for the current community. |
| POST | /api/offers | Create an approved or manual offer. |
| PATCH | /api/offers/:id | Edit price limits, quantity, or Auto Adjust. |
| POST | /api/offers/:id/cancel | Cancel an eligible offer. |
| POST | /api/reservations | Create a buyer reservation. |
| PATCH | /api/reservations/:id | Edit the maximum price or quantity. |
| POST | /api/reservations/:id/cancel | Cancel before the cutoff. |
| GET | /api/allocations/:id | Read allocation and price explanation. |
| GET | /api/settlements | Household settlement history. |

### Operator

| Method | Route | Purpose |
| --- | --- | --- |
| PATCH | /api/operator/tariffs | Create a new tariff version. |
| PATCH | /api/operator/feeder | Update the feeder scenario. |
| POST | /api/operator/market/:interval/pause | Pause an interval. |
| POST | /api/operator/market/:interval/resume | Resume an interval. |
| GET | /api/operator/audit | Query market and data events. |

### Internal jobs

| Method | Route | Purpose |
| --- | --- | --- |
| POST | /api/internal/forecast | Refresh due forecasts. |
| POST | /api/internal/reprice | Recalculate interval suggestions. |
| POST | /api/internal/match | Run idempotent interval matching. |
| POST | /api/internal/settle | Settle closed intervals. |

Protect internal routes with a server-held secret or scheduled-job identity.

## 22. Realtime events

Subscribe only to rows the current user is allowed to see.

Useful events:

- offer.created
- offer.updated
- reservation.created
- reservation.updated
- allocation.created
- price.suggested
- settlement.completed
- feeder.updated

Realtime events tell the client that state changed. The client should refetch authoritative data rather than treating an event payload as the final ledger record.

## 23. Authentication and Row Level Security

### Household policies

- A user can read and update their own profile.
- A user can read only their active community memberships.
- A seller can modify only their own open offers.
- A buyer can modify only their own open reservations.
- A household can read only its own detailed allocations and settlements.
- Community users can read privacy-safe aggregate market data.
- Raw readings are private to the asset owner and authorized operators.

### Operator policies

- An operator can access only communities where they have an active operator membership.
- Tariff and feeder changes require operator access and create audit records.
- The browser never receives service-role credentials.

### Location policies

- Exact imported coordinates, if collected later, stay private.
- The map API returns only rounded or jittered coordinates.
- Map payloads use anonymous feature IDs rather than account IDs.

## 24. Data validation rules

Reject or flag:

- Negative energy where the metric does not allow it.
- An interval whose end is not after its start.
- Unsupported interval lengths.
- Duplicate asset, metric, and interval combinations from the same source.
- A solar capacity, tilt, or azimuth outside the documented range.
- NaN, infinity, or malformed numeric values.
- Tariff settings where the feed-in rate is not below the retail rate.
- An offer larger than the approved forecast surplus unless it is explicitly marked manual.
- A reservation with a non-positive quantity.
- A user price outside the configured market corridor.
- Timestamps without a known timezone.
- CSV rows that would cross a community or asset boundary.

Warnings may be appropriate for gaps and unusual spikes. Rejection is appropriate for invalid units, impossible timestamps, or unauthorized assets.

## 25. Simulation design

Use seeded and repeatable scenarios. Accept a random seed so a failed test can be reproduced.

### Solar seller profile

- A daytime bell-shaped generation curve.
- Lower production on the weather-change scenario.
- Household base load with a midday dip or appliance spike.
- Configurable reserve.

### Buyer profiles

- Work-from-home household with steady daytime demand.
- Household with a midday cooking peak.
- Household with low daytime demand.
- Flexible household using Green Saver.

### Feeder profiles

- Normal load.
- High import load during the sharing window.
- A sudden increase that triggers repricing.

### Required scenario

1. SolarShare publishes expected surplus.
2. Buyers reserve most of it.
3. The weather input reduces expected generation.
4. The system revises the suggestion for any unallocated supply.
5. Final simulated generation is below the original forecast.
6. Settlement reduces deliveries proportionally.
7. Seller credits and buyer savings update.

## 26. UI rules

The interface is for ordinary household users. Technical values should be available without becoming the default language.

- Use kWh and INR in user-facing energy and price text.
- Label modeled, simulated, imported, and connected data.
- Show the time window in the community timezone.
- Use one main action per screen.
- Put formulas and source details behind an explanation panel.
- Show expected values as estimates.
- Explain why a price changed.
- Require confirmation before enabling Auto Share or Auto Adjust.
- Keep Stop Sharing visible on an active offer.
- Do not display exact household addresses on the map.
- Show empty, loading, stale-data, provider-error, and partial-settlement states.

## 27. Error handling and fallbacks

### Provider failure

1. Use a recent cached response if it is still valid.
2. Otherwise use a stored sample response.
3. Mark the forecast as fallback data.
4. Do not silently label fallback data as live.

### Import failure

- Preserve the validation report.
- Let the user download rejected rows.
- Do not commit a partial file without explicit confirmation.

### Matching failure

- Roll back the database transaction.
- Keep offers and reservations unchanged.
- Record the idempotency key and error.
- Allow a safe retry.

### Settlement failure

- Do not write half of the debit and credit pair.
- Keep the interval in settlement_pending.
- Show the operator a retry action and audit detail.

## 28. Testing plan

### Unit tests

- Unit normalization for W, kW, Wh, and kWh.
- Timezone and 15-minute interval conversion.
- Surplus calculation.
- Price corridor and clamping.
- Demand-pressure edge cases.
- Congestion threshold behavior.
- Price-limit overlap.
- Proportional allocation reduction.
- Decimal rounding.
- CSV validation.

### Integration tests

- Create an offer from a forecast.
- Reserve and match energy in one transaction.
- Prevent duplicate allocations on retry.
- Enforce community boundaries.
- Import readings and select the preferred source.
- Settle with full delivery.
- Settle with reduced delivery.
- Reprice an unmatched offer without changing a disabled Auto Adjust limit.
- Verify Row Level Security for household and operator accounts.

### End-to-end tests

- Seller setup to published offer.
- Buyer reservation to live allocation.
- CSV import preview and commit.
- Weather fallback label.
- Feeder scenario change and price explanation.
- Final settlement and CSV export.
- Approximate map pins without leaked addresses.

### Manual checks

- Mobile and desktop layouts.
- Keyboard navigation.
- Contrast and focus states.
- Slow network behavior.
- Empty market.
- Provider outage.
- Two browser sessions updating the same interval.

## 29. Seed data

Create:

- One community.
- One operator account.
- One prosumer account with a solar asset.
- Four buyer accounts.
- Feed-in and retail tariff assumptions.
- One normal feeder scenario and one constrained scenario.
- A full day of 15-minute generation and demand readings.
- An open offer, buyer reservations, and one completed settlement.

Keep the credentials in local setup documentation, not in public source files.

## 30. Environment and configuration

Suggested environment variables:

    NEXT_PUBLIC_SUPABASE_URL=
    NEXT_PUBLIC_SUPABASE_ANON_KEY=
    SUPABASE_SERVICE_ROLE_KEY=
    OPEN_METEO_BASE_URL=
    PVGIS_BASE_URL=
    GEOCODING_BASE_URL=
    INTERNAL_JOB_SECRET=
    APP_TIMEZONE=Asia/Kolkata
    APP_CURRENCY=INR

Rules:

- Only variables prefixed with NEXT_PUBLIC may reach browser code.
- Provider URLs belong in configuration so mock servers can replace them in tests.
- Tariffs and market weights belong in versioned database configuration, not environment variables.
- Never put imported device credentials in plain database columns.

## 31. Implementation order

### Phase A: foundation

1. Create the Next.js project and shared styling.
2. Create Supabase environments and migrations.
3. Add authentication, profiles, communities, and memberships.
4. Add seeded accounts and community data.
5. Implement navigation RLS before market data is exposed.

Exit condition: each role can sign in and reaches the correct empty dashboard.

### Phase B: energy data

1. Add solar asset setup.
2. Implement units and interval utilities.
3. Add the reading and forecast tables.
4. Build the simulator.
5. Add Open-Meteo and PVGIS adapters with caching.
6. Build CSV validation, preview, commit, and export.
7. Add source-selection rules and labels.

Exit condition: a seller can see a full day of 15-minute generation, demand, reserve, and expected surplus.

### Phase C: marketplace

1. Add tariff configuration.
2. Build Guided Sharing and manual offer creation.
3. Build the marketplace and reservation flow.
4. Implement the pricing service.
5. Implement interval matching with transaction safety.
6. Add Realtime updates.

Exit condition: a seller publishes energy and buyers receive allocations at an explainable price.

### Phase D: settlement

1. Generate or import final readings.
2. Implement final-surplus calculation.
3. Implement partial-delivery allocation.
4. Add settlement and ledger records.
5. Show seller credit and buyer savings.
6. Add settlement export.

Exit condition: the complete reservation-to-settlement path works and survives a retry.

### Phase E: operator and map

1. Add approximate community pins.
2. Add tariff and feeder controls.
3. Add market interval and settlement views.
4. Add audit and data-health screens.
5. Verify privacy-safe map payloads.

Exit condition: the operator can change a feeder scenario and see the price and matching response.

### Phase F: hardening

1. Run unit, integration, and end-to-end tests.
2. Test mobile layout and accessibility.
3. Test cached and sample-data fallbacks.
4. Add loading, empty, stale, and error states.
5. Verify that every displayed value has the correct source label.
6. Prepare a clean seed reset.

Exit condition: the seeded workflow is repeatable from a fresh database.

## 32. Definition of done

The prototype is ready when:

- A judge can identify the Renewable Energy P2P Trading Marketplace track.
- A seller can configure solar, review a surplus suggestion, and publish an offer.
- A buyer can reserve local solar and see the estimated cost and saving.
- Supply, demand, and feeder congestion affect a bounded market price.
- Matching respects community, interval, quantity, and price limits.
- Final readings can reduce a reservation during settlement.
- The ledger balances seller credits and buyer costs.
- The operator can inspect tariffs, feeder conditions, and market records.
- CSV import and export work with validation.
- The map shows approximate community activity without exposing addresses.
- Public, modeled, imported, connected, and simulated values are labelled.
- Provider outages fall back without pretending sample data is live.
- Authorization tests prevent access across users and communities.

## 33. Research document to create next

The next document should validate the scientific and market assumptions before the forecast and price constants are finalized.

### Solar engineering research

- Recommended panel orientation by hemisphere and location.
- Tilt relative to latitude and seasonal goals.
- Azimuth conventions used by PVGIS, Open-Meteo, inverter vendors, and the app.
- Effect of shading, temperature, soiling, inverter efficiency, and clipping.
- Difference between DC array capacity and AC inverter output.
- Converting irradiance and power into 15-minute energy.
- Inputs required by PVGIS and useful fields returned.
- How customer inverter history can calibrate the model.
- What confidence range is reasonable for a prototype.

### Pricing research

- Common feed-in and retail tariff structures relevant to the chosen Indian location.
- Whether time-of-day tariffs should be represented.
- How local supply-demand ratios should move the price.
- How feeder import congestion should affect price and priority.
- Seller and buyer benefit margins.
- Pro-rata versus time-priority allocation during shortage.
- Worked INR examples for normal, oversupplied, scarce, and congested intervals.
- Sensitivity tests for all pricing weights.

### API and mapping research

- Current Open-Meteo fields, limits, and attribution.
- Current PVGIS endpoints, units, and orientation conventions.
- Geocoder and map-tile usage policies.
- Caching and fallback rules.
- SunSpec, Home Assistant, and common inverter-integration patterns.
- A provider comparison table with cost, authentication, rate limits, and demo suitability.

## 34. Questions for the research step

Do not finalize these values until the research is complete:

1. What location will be used for the seeded solar home?
2. What panel capacity, tilt, and azimuth should the sample asset use?
3. Which PVGIS endpoint fits the short-term forecast workflow?
4. Which Open-Meteo variables should adjust the baseline?
5. What feed-in and retail tariff assumptions will the demo use?
6. What seller margin and buyer discount should define the price corridor?
7. What demand and congestion weights produce sensible changes?
8. What feeder warning level should trigger the congestion response?
9. How should missing imported intervals be filled?
10. Which CSV formats from common inverters are worth supporting directly?

## 35. Common implementation mistakes to avoid

- Treating modeled PV output as a live inverter reading.
- Displaying exact household coordinates.
- Mixing kW and kWh.
- Losing timezone information during CSV import.
- Replacing old forecasts instead of versioning them.
- Using JavaScript floating-point values for financial settlement.
- Letting the client decide authorization or final price.
- Running matching without a database transaction.
- Changing user limits when Auto Adjust is disabled.
- Applying import-congestion logic to export congestion.
- Showing fallback data without a fallback label.
- Building real payments before the energy workflow is stable.
- Coupling the application to one inverter or map provider.

## 36. Immediate next actions

1. Complete the solar and pricing research document.
2. Choose the seeded location and solar asset.
3. Confirm the tariff assumptions.
4. Create the Next.js and Supabase project.
5. Implement the database schema and RLS.
6. Build the simulator and source labels.
7. Implement the seller and buyer path before optional operator detail.

This blueprint is the baseline. Update it when a research result or implementation decision changes the design.
