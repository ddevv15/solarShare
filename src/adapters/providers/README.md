# Provider adapters

This area will translate external weather, solar, geocoding, and device responses into SolarShare types. Each live adapter validates payloads, uses an explicit timeout, and applies bounded retries before the fallback chain moves to cache and stored sample data.
