-- Update env_data_cache table to support zone-based layer types + system keys
-- Run this in Supabase SQL Editor

-- Drop the old check constraint
ALTER TABLE public.env_data_cache 
DROP CONSTRAINT IF EXISTS env_data_cache_layer_type_check;

-- Add new constraint that allows all zone-based layer types and system keys
ALTER TABLE public.env_data_cache 
ADD CONSTRAINT env_data_cache_layer_type_check 
CHECK (
  layer_type IN (
    -- Legacy single-layer types (backward compatibility)
    'wind', 'aqi', 'earthquakes', 'wildfires', 'storms', 'sea_temp', 'temp_anomaly',
    -- System keys
    'cleanup_last_run'
  ) OR
  -- Zone-based layer types
  layer_type LIKE 'wind_zone_%'  OR
  layer_type LIKE 'temp_zone_%'  OR
  layer_type LIKE 'aqi_zone_%'   OR
  layer_type LIKE 'sea_zone_%'
);

-- Verify
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.env_data_cache'::regclass 
AND conname = 'env_data_cache_layer_type_check';
