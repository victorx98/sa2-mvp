-- Contract number generator function
-- Format: CONTRACT-YYYY-MM-NNNNN (monthly sequence)
-- Features:
--   - Thread-safe using Advisory Lock
--   - Auto-reset monthly
--   - Max 99999 contracts per month
--   - Concurrent-safe sequence generation

-- Create sequence for contract numbers
CREATE SEQUENCE IF NOT EXISTS contract_number_seq START WITH 1 INCREMENT BY 1;

-- Function to generate unique contract number
-- Returns format: CONTRACT-YYYY-MM-NNNNN
-- Example: CONTRACT-2025-11-00001
CREATE OR REPLACE FUNCTION generate_contract_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year INT;
  current_month INT;
  current_seq BIGINT;
  contract_code VARCHAR(50);
  lock_key BIGINT;
BEGIN
  -- Get current year and month
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  current_month := EXTRACT(MONTH FROM CURRENT_DATE);

  -- Generate lock key based on year and month
  -- Format: YYYYMM (e.g., 202511)
  lock_key := (current_year * 100 + current_month)::BIGINT;

  -- Acquire advisory lock to prevent concurrent number generation
  -- Advisory lock is automatically released at transaction end
  PERFORM pg_advisory_xact_lock(lock_key);

  -- Get next sequence value
  current_seq := nextval('contract_number_seq');

  -- Check if we've exceeded the monthly limit
  IF current_seq > 99999 THEN
    RAISE EXCEPTION 'Contract number limit exceeded for month %-%. Maximum 99999 contracts per month.',
      current_year, LPAD(current_month::TEXT, 2, '0');
  END IF;

  -- Reset sequence if we're in a new month
  -- This requires checking if the last contract was from a previous month
  -- For simplicity, we use a global state table approach
  -- Create metadata table if not exists (run separately in migration)

  -- Format contract number: CONTRACT-YYYY-MM-NNNNN
  contract_code := 'CONTRACT-' ||
                   current_year::TEXT || '-' ||
                   LPAD(current_month::TEXT, 2, '0') || '-' ||
                   LPAD(current_seq::TEXT, 5, '0');

  RETURN contract_code;
END;
$$ LANGUAGE plpgsql;

-- Metadata table to track monthly sequence reset
CREATE TABLE IF NOT EXISTS contract_number_metadata (
  id SERIAL PRIMARY KEY,
  year INT NOT NULL,
  month INT NOT NULL,
  last_sequence INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(year, month)
);

-- Improved contract number generator with monthly reset
CREATE OR REPLACE FUNCTION generate_contract_number_v2()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year INT;
  current_month INT;
  current_seq INT;
  contract_code VARCHAR(50);
  lock_key BIGINT;
BEGIN
  -- Get current year and month
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  current_month := EXTRACT(MONTH FROM CURRENT_DATE);

  -- Generate lock key based on year and month
  lock_key := (current_year * 100 + current_month)::BIGINT;

  -- Acquire advisory lock
  PERFORM pg_advisory_xact_lock(lock_key);

  -- Insert or update metadata record for current month
  INSERT INTO contract_number_metadata (year, month, last_sequence)
  VALUES (current_year, current_month, 1)
  ON CONFLICT (year, month)
  DO UPDATE SET
    last_sequence = contract_number_metadata.last_sequence + 1,
    updated_at = NOW()
  RETURNING last_sequence INTO current_seq;

  -- Check monthly limit
  IF current_seq > 99999 THEN
    RAISE EXCEPTION 'Contract number limit exceeded for month %-%. Maximum 99999 contracts per month.',
      current_year, LPAD(current_month::TEXT, 2, '0');
  END IF;

  -- Format contract number: CONTRACT-YYYY-MM-NNNNN
  contract_code := 'CONTRACT-' ||
                   current_year::TEXT || '-' ||
                   LPAD(current_month::TEXT, 2, '0') || '-' ||
                   LPAD(current_seq::TEXT, 5, '0');

  RETURN contract_code;
END;
$$ LANGUAGE plpgsql;

-- Usage example:
-- INSERT INTO contracts (contract_number, ...)
-- VALUES (generate_contract_number_v2(), ...);

-- Notes:
-- 1. Use generate_contract_number_v2() for production (includes monthly reset)
-- 2. Advisory lock ensures thread-safety under high concurrency
-- 3. Lock is automatically released at transaction end (COMMIT or ROLLBACK)
-- 4. Each month starts from 00001 and increments sequentially
-- 5. Maximum 99999 contracts per month (raises exception if exceeded)
