-- Add status column to move_analysis table
ALTER TABLE public.move_analysis ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Create index for faster querying by status
CREATE INDEX IF NOT EXISTS move_analysis_status_idx ON public.move_analysis(status);