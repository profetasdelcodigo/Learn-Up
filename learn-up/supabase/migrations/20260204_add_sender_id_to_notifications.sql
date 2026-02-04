-- Add sender_id column to notifications table
-- This enables direct friend request acceptance from notification center

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add index for better performance on queries
CREATE INDEX IF NOT EXISTS idx_notifications_sender_id ON notifications(sender_id);
