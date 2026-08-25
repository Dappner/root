-- Add speaker and context columns to citations table
ALTER TABLE citations ADD COLUMN speaker TEXT;
ALTER TABLE citations ADD COLUMN context TEXT;
