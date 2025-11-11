-- Contract Entitlement Revisions Table
-- Records history of contract service entitlement changes for audit trail and version management

-- =================================================================================
-- v2.16.9 Updates: Remove TTL from service_holds
-- =================================================================================

-- Check if expires_at column exists and drop it
ALTER TABLE service_holds DROP COLUMN IF EXISTS expires_at;

-- Update hold_status enum to remove 'expired' status (v2.16.9)
-- Note: PostgreSQL doesn't support removing enum values, so we create a new enum and migrate
-- For now, we'll keep the enum but ensure application code doesn't use 'expired' status

-- =================================================================================
-- v2.16.9 Updates: Add 'draft' status to contract_status enum
-- =================================================================================

-- Add 'draft' status to contract_status enum
-- Note: PostgreSQL doesn't support adding enum values without them being at the end
-- We need to check if 'draft' already exists first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'contract_status'::regtype::oid
      AND enumlabel = 'draft'
  ) THEN
    ALTER TYPE contract_status ADD VALUE 'draft' BEFORE 'signed';
  END IF;
END $$;

-- Create enum types
CREATE TYPE entitlement_revision_type AS ENUM (
  'initial',      -- Initial entitlements (when contract is created)
  'addon',        -- Additional entitlements (for closing deals)
  'promotion',    -- Promotional entitlements
  'compensation', -- Compensation entitlements
  'increase',     -- Manual increase
  'decrease',     -- Manual decrease
  'expiration',   -- Expiration adjustment
  'termination'   -- Termination processing
);

CREATE TYPE revision_status AS ENUM (
  'pending',   -- Pending approval
  'approved',  -- Approved
  'rejected',  -- Rejected
  'applied'    -- Applied (effective)
);

-- Create table
CREATE TABLE contract_entitlement_revisions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Contract reference
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,

  -- Entitlement reference (nullable for some historical records)
  entitlement_id UUID REFERENCES contract_service_entitlements(id) ON DELETE SET NULL,

  -- Service identification
  service_type VARCHAR(100) NOT NULL,
  service_name VARCHAR(500) NOT NULL,

  -- Revision versioning (global increment per contract)
  revision_number INTEGER NOT NULL,

  -- Revision metadata
  revision_type entitlement_revision_type NOT NULL,
  source VARCHAR(50) NOT NULL,  -- 'product', 'addon', 'promotion', 'compensation'

  -- Quantity changes
  quantity_changed INTEGER NOT NULL,  -- Positive for addition, negative for reduction
  total_quantity INTEGER NOT NULL,    -- Total after change
  available_quantity INTEGER NOT NULL, -- Available after change

  -- Approval workflow
  status revision_status NOT NULL DEFAULT 'pending',
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,

  -- Additional information
  add_on_reason TEXT,  -- Required for addon/promotion/compensation
  description TEXT,
  attachments JSONB,   -- Array of attachment URLs

  -- Creator
  created_by UUID REFERENCES users(id),

  -- Related business records
  related_booking_id UUID,
  related_hold_id UUID,
  related_product_id UUID,

  -- Snapshots for audit
  snapshot JSONB,  -- { serviceSnapshot, productSnapshot, originItems }

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for efficient querying
CREATE INDEX idx_entitlement_revisions_contract ON contract_entitlement_revisions(contract_id);
CREATE INDEX idx_entitlement_revisions_entitlement ON contract_entitlement_revisions(entitlement_id);
CREATE INDEX idx_entitlement_revisions_service_type ON contract_entitlement_revisions(service_type);
CREATE INDEX idx_entitlement_revisions_revision_type ON contract_entitlement_revisions(revision_type);
CREATE INDEX idx_entitlement_revisions_status ON contract_entitlement_revisions(status);
CREATE INDEX idx_entitlement_revisions_created_at ON contract_entitlement_revisions(created_at DESC);

-- Create unique constraint: revision numbers must be unique per contract
CREATE UNIQUE INDEX idx_entitlement_revisions_version_unique
ON contract_entitlement_revisions(contract_id, revision_number);

-- Create composite indexes for common query patterns
CREATE INDEX idx_entitlement_revisions_contract_service
ON contract_entitlement_revisions(contract_id, service_type, revision_number DESC);

CREATE INDEX idx_entitlement_revisions_pending_approval
ON contract_entitlement_revisions(status, requires_approval)
WHERE status = 'pending' AND requires_approval = true;

-- CHECK constraints for data integrity
ALTER TABLE contract_entitlement_revisions
ADD CONSTRAINT chk_quantity_changed_not_zero CHECK (quantity_changed != 0);

ALTER TABLE contract_entitlement_revisions
ADD CONSTRAINT chk_approval_consistency CHECK (
  (status != 'pending') OR (status = 'pending' AND requires_approval = true)
);

-- Comments for documentation
COMMENT ON TABLE contract_entitlement_revisions IS 'Records history of contract service entitlement changes for audit trail';
COMMENT ON COLUMN contract_entitlement_revisions.revision_number IS 'Global revision number, increments per contract (1, 2, 3...)';
COMMENT ON COLUMN contract_entitlement_revisions.quantity_changed IS 'Positive for additions, negative for reductions';
COMMENT ON COLUMN contract_entitlement_revisions.snapshot IS 'Stores service/product snapshots for historical reference';
