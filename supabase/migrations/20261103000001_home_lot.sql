-- The real home lot: 851 Harbor Island Dr, San Diego (replaces the placeholder rectangle near LAX).
-- The outline is a box about 80 m across around the pin 32.72559, -117.19475.
update settings
set data = jsonb_set(
  data,
  '{homeLot}',
  '{"name": "Home lot", "address": "851 Harbor Island Dr, San Diego, CA 92101", "polygon": [{"latitude": 32.72594, "longitude": -117.1952}, {"latitude": 32.72594, "longitude": -117.1943}, {"latitude": 32.72524, "longitude": -117.1943}, {"latitude": 32.72524, "longitude": -117.1952}]}'::jsonb
)
where id = 1 and data -> 'homeLot' ->> 'address' = 'Address TBD (placeholder near LAX)';

-- Starting car positions that were inside the old placeholder lot move into the real one.
update telemetry
set lat = 32.72559 + (lat - 33.9462), lng = -117.19475 + (lng - (-118.3838))
where lat between 33.94 and 33.95 and lng between -118.39 and -118.38;
