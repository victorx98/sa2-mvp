-- Add created_by_counselor_id to classes table
ALTER TABLE classes 
  ADD COLUMN IF NOT EXISTS created_by_counselor_id UUID REFERENCES "user"(id);

-- Add created_by_counselor_id to class_sessions table
ALTER TABLE class_sessions 
  ADD COLUMN IF NOT EXISTS created_by_counselor_id UUID REFERENCES "user"(id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_classes_created_by_counselor ON classes(created_by_counselor_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_created_by_counselor ON class_sessions(created_by_counselor_id);

