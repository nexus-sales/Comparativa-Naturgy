-- Añadir columna de tarifa y sector a client_comparisons para mejores estadísticas
ALTER TABLE client_comparisons 
ADD COLUMN IF NOT EXISTS target_tariff TEXT,
ADD COLUMN IF NOT EXISTS target_segment TEXT;

-- Actualizar registros existentes desde calculation_data si es posible
UPDATE client_comparisons
SET 
  target_tariff = calculation_data->>'best_tariff',
  target_segment = calculation_data->>'segment'
WHERE target_tariff IS NULL OR target_segment IS NULL;

-- Comentario para documentación
COMMENT ON COLUMN client_comparisons.target_tariff IS 'La tarifa recomendada u ofertada';
COMMENT ON COLUMN client_comparisons.target_segment IS 'El segmento del cliente (Residencial, Pyme, etc.)';
