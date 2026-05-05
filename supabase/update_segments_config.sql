-- 1. Añadir columnas de configuración a la tabla de segmentos
ALTER TABLE segments 
ADD COLUMN IF NOT EXISTS bono_rate NUMERIC DEFAULT 0.012742,
ADD COLUMN IF NOT EXISTS excedente_rate NUMERIC DEFAULT 0.06,
ADD COLUMN IF NOT EXISTS tax_imp_elec NUMERIC DEFAULT 5.1127,
ADD COLUMN IF NOT EXISTS tax_igic NUMERIC DEFAULT 7,
ADD COLUMN IF NOT EXISTS tax_igic_red NUMERIC DEFAULT 3,
ADD COLUMN IF NOT EXISTS tax_igic_7 NUMERIC DEFAULT 7;

-- 2. Habilitar permisos de actualización para administradores
-- Asumiendo que existe una política de lectura, añadimos la de actualización
CREATE POLICY "Admins can update segments" 
ON segments 
FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- 3. Actualizar los valores actuales con los valores por defecto del código
UPDATE segments SET 
  bono_rate = 0.012742,
  excedente_rate = 0.06,
  tax_imp_elec = 5.1127,
  tax_igic = CASE WHEN id = 'res' THEN 7 ELSE 0 END,
  tax_igic_red = CASE WHEN id = 'res' THEN 0 ELSE 3 END,
  tax_igic_7 = CASE WHEN id = 'res' THEN 0 ELSE 7 END;
