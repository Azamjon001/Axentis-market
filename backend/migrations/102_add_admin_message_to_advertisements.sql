-- Add admin_message column to store detailed admin feedback
ALTER TABLE advertisements 
ADD COLUMN IF NOT EXISTS admin_message TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_advertisements_admin_message 
ON advertisements(id) 
WHERE admin_message IS NOT NULL;
