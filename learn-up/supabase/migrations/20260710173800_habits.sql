CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'daily',
  target_time TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  archived BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS habit_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(habit_id, completed_date)
);

ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS recurrence_rule TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS recurrence_end DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;

ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own habits" ON habits
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own habit completions" ON habit_completions
  FOR ALL USING (auth.uid() = user_id);
