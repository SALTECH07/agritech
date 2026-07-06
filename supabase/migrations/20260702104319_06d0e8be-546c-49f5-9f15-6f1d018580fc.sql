-- Safisha data za zamani zisizowezekana
DELETE FROM public.readings
WHERE soil_ph IS NOT NULL AND (soil_ph > 10 OR soil_ph < 3);

DELETE FROM public.readings
WHERE soil_moisture IS NOT NULL AND (soil_moisture > 100 OR soil_moisture < 0);

DELETE FROM public.readings
WHERE water_level IS NOT NULL AND (water_level > 100 OR water_level < 0);

DELETE FROM public.readings
WHERE air_humidity IS NOT NULL AND (air_humidity > 100 OR air_humidity < 0);

DELETE FROM public.readings
WHERE air_temp IS NOT NULL AND (air_temp > 60 OR air_temp < -10);

-- Zuia data zisizowezekana zisiingie tena (defense-in-depth pamoja na server clamps)
ALTER TABLE public.readings
  ADD CONSTRAINT readings_soil_ph_range CHECK (soil_ph IS NULL OR (soil_ph >= 3 AND soil_ph <= 10)),
  ADD CONSTRAINT readings_soil_moisture_range CHECK (soil_moisture IS NULL OR (soil_moisture >= 0 AND soil_moisture <= 100)),
  ADD CONSTRAINT readings_water_level_range CHECK (water_level IS NULL OR (water_level >= 0 AND water_level <= 100)),
  ADD CONSTRAINT readings_air_humidity_range CHECK (air_humidity IS NULL OR (air_humidity >= 0 AND air_humidity <= 100)),
  ADD CONSTRAINT readings_air_temp_range CHECK (air_temp IS NULL OR (air_temp >= -10 AND air_temp <= 60));
