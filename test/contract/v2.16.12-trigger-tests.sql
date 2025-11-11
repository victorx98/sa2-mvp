-- ==============================================================================
-- v2.16.12 Trigger Execution Test Scenarios (学生级权益累积制测试)
-- ==============================================================================
-- This test suite verifies that all 4 triggers work correctly with the
-- student-level entitlement accumulation architecture.
-- ==============================================================================

-- ==============================================================================
-- Test Setup (测试准备)
-- v2.16.13: contract_entitlement_ledgers renamed to contract_amendment_ledgers
-- ==============================================================================

-- Create test student
INSERT INTO "user" (id, email, name, user_type)
VALUES ('test-student-001', 'test-student@example.com', 'Test Student', 'student')
ON CONFLICT (id) DO NOTHING;

-- Create test mentor (for created_by fields)
INSERT INTO "user" (id, email, name, user_type)
VALUES ('test-mentor-001', 'test-mentor@example.com', 'Test Mentor', 'mentor')
ON CONFLICT (id) DO NOTHING;

-- Create a test product (needed for contract creation)
INSERT INTO products (
  id, product_name, product_code, product_type, status,
  base_price, currency, validity_days, billing_mode,
  created_by
)
VALUES (
  'test-product-001',
  'Test Session Product',
  'TEST-SESSION',
  'service',
  'active',
  100.00,
  'USD',
  365,
  'times',
  'test-mentor-001'
)
ON CONFLICT (id) DO NOTHING;

-- Create a test service
INSERT INTO services (
  id, service_name, service_code, service_type, billing_mode,
  requires_evaluation, requires_mentor_assignment, created_by
)
VALUES (
  'test-service-001',
  'Test Session Service',
  'TEST-SESSION',
  'session',
  'times',
  false,
  true,
  'test-mentor-001'
)
ON CONFLICT (id) DO NOTHING;

-- Create test product item
INSERT INTO product_items (
  id, product_id, product_item_type, product_item_id, quantity
)
VALUES (
  'test-product-item-001',
  'test-product-001',
  'service',
  'test-service-001',
  1
)
ON CONFLICT (id) DO NOTHING;

-- Create first contract for student (5 sessions)
INSERT INTO contracts (
  id, contract_number, title, student_id, product_id,
  product_snapshot, status, total_amount, currency,
  signed_at, expires_at, created_by
)
VALUES (
  'test-contract-001',
  'TEST-001',
  'Test Contract 1',
  'test-student-001',
  'test-product-001',
  '{"productName": "Test Session Product", "items": [{"productItemType": "service", "productItemId": "test-product-item-001", "quantity": 5, "service": {"serviceId": "test-service-001", "serviceName": "Test Session Service", "serviceCode": "TEST-SESSION", "serviceType": "session", "billingMode": "times", "requiresEvaluation": false, "requiresMentorAssignment": true, "snapshotAt": "2025-01-01T00:00:00Z"}}]}',
  'active',
  500.00,
  'USD',
  NOW() - INTERVAL '10 days',
  NOW() + INTERVAL '355 days',
  'test-mentor-001'
)
ON CONFLICT (id) DO NOTHING;

-- Create second contract for student (3 sessions)
INSERT INTO contracts (
  id, contract_number, title, student_id, product_id,
  product_snapshot, status, total_amount, currency,
  signed_at, expires_at, created_by
)
VALUES (
  'test-contract-002',
  'TEST-002',
  'Test Contract 2',
  'test-student-001',
  'test-product-001',
  '{"productName": "Test Session Product", "items": [{"productItemType": "service", "productItemId": "test-product-item-001", "quantity": 3, "service": {"serviceId": "test-service-001", "serviceName": "Test Session Service", "serviceCode": "TEST-SESSION", "serviceType": "session", "billingMode": "times", "requiresEvaluation": false, "requiresMentorAssignment": true, "snapshotAt": "2025-01-01T00:00:00Z"}}]}',
  'active',
  300.00,
  'USD',
  NOW() - INTERVAL '5 days',
  NOW() + INTERVAL '360 days',
  'test-mentor-001'
)
ON CONFLICT (id) DO NOTHING;

-- Verify initial entitlements were created by contract.activation triggers
-- Should show: total_quantity = 5 (contract 1) + 3 (contract 2) = 8
SELECT
  student_id,
  service_type,
  total_quantity,
  consumed_quantity,
  held_quantity,
  available_quantity
FROM contract_service_entitlements
WHERE student_id = 'test-student-001';

-- Expected result: 1 row with total_quantity = 8, available_quantity = 8

-- ==============================================================================
-- TEST 1: Trigger 1 - contract_amendment_ledgers → contract_service_entitlements
-- Test: Contract amendments should automatically update total_quantity
-- ==============================================================================

-- Insert contract amendment (promotion: +2 sessions)
INSERT INTO contract_amendment_ledgers (
  student_id, service_type, ledger_type, quantity_changed, reason, created_by
)
VALUES (
  'test-student-001',
  'session',
  'promotion',
  2,
  'Holiday promotion - extra 2 sessions',
  'test-mentor-001'
);

-- Verify the trigger worked
SELECT
  student_id,
  service_type,
  total_quantity,
  consumed_quantity,
  held_quantity,
  available_quantity
FROM contract_service_entitlements
WHERE student_id = 'test-student-001';

-- Expected: total_quantity = 10 (8 + 2), available_quantity = 10

-- ==============================================================================
-- TEST 2: Trigger 2 - service_ledgers → contract_service_entitlements (Consumption)
-- Test: Recording service consumption should update consumed_quantity and reduce available
-- ==============================================================================

-- Record first session consumption
INSERT INTO service_ledgers (
  student_id, service_type, quantity, type, source, balance_after,
  related_booking_id, created_by
)
VALUES (
  'test-student-001',
  'session',
  -1,
  'consumption',
  'booking_completed',
  9, -- Will be verified by trigger
  'test-session-001',
  'test-mentor-001'
);

-- Verify the trigger worked
SELECT
  student_id,
  service_type,
  total_quantity,
  consumed_quantity,
  held_quantity,
  available_quantity
FROM contract_service_entitlements
WHERE student_id = 'test-student-001';

-- Expected: total_quantity = 10, consumed_quantity = 1, available_quantity = 9

-- ==============================================================================
-- TEST 3: Trigger 3 - service_holds → contract_service_entitlements (Hold Creation)
-- Test: Creating a service hold should increase held_quantity and reduce available
-- ==============================================================================

-- Create a service hold for a future session
INSERT INTO service_holds (
  student_id, service_type, quantity, status, related_booking_id, created_by
)
VALUES (
  'test-student-001',
  'session',
  1,
  'active',
  'test-session-002',
  'test-mentor-001'
) RETURNING id;

-- Store the hold ID for later use
-- (In real testing, capture the returned ID)

-- Verify the trigger worked
SELECT
  student_id,
  service_type,
  total_quantity,
  consumed_quantity,
  held_quantity,
  available_quantity
FROM contract_service_entitlements
WHERE student_id = 'test-student-001';

-- Expected: total_quantity = 10, consumed_quantity = 1, held_quantity = 1, available_quantity = 8

-- ==============================================================================
-- TEST 4: Trigger 3 - service_holds → contract_service_entitlements (Hold Release)
-- Test: Releasing a hold should decrease held_quantity and increase available
-- ==============================================================================

-- Release the hold (update the ID based on the previous INSERT RETURNING)
UPDATE service_holds
SET
  status = 'released',
  release_reason = 'completed',
  released_at = NOW()
WHERE student_id = 'test-student-001'
  AND service_type = 'session'
  AND status = 'active'
  AND related_booking_id = 'test-session-002';

-- Verify the trigger worked
SELECT
  student_id,
  service_type,
  total_quantity,
  consumed_quantity,
  held_quantity,
  available_quantity
FROM contract_service_entitlements
WHERE student_id = 'test-student-001';

-- Expected: total_quantity = 10, consumed_quantity = 1, held_quantity = 0, available_quantity = 9

-- ==============================================================================
-- TEST 5: Trigger 4 - contracts → contract_service_entitlements (Contract Termination)
-- Test: Terminating contract should freeze entitlements (available_quantity = 0)
-- ==============================================================================

-- Terminate the first contract
UPDATE contracts
SET status = 'terminated',
    terminated_at = NOW()
WHERE id = 'test-contract-001';

-- Verify the trigger worked - ALL entitlements for the student should be frozen
SELECT
  student_id,
  service_type,
  total_quantity,
  consumed_quantity,
  held_quantity,
  available_quantity
FROM contract_service_entitlements
WHERE student_id = 'test-student-001';

-- Expected: available_quantity = 0 (all entitlements frozen)

-- ==============================================================================
-- Test Edge Cases
-- ==============================================================================

-- TEST 6: Edge Case - Attempt to add ledger without existing entitlement (should fail)
-- This tests Decision D-NEW-1: Trigger should throw exception
DO $$
BEGIN
  INSERT INTO contract_amendment_ledgers (
    student_id, service_type, ledger_type, quantity_changed, reason, created_by
  )
  VALUES (
    'test-student-001',
    'mock_interview', -- Service type without entitlement
    'addon',
    1,
    'This should fail',
    'test-mentor-001'
  );

  RAISE EXCEPTION 'TEST FAILED: Should have thrown exception for missing entitlement';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%Entitlement not found%' THEN
      RAISE NOTICE 'TEST PASSED: Correctly threw exception for missing entitlement';
    ELSE
      RAISE EXCEPTION 'TEST FAILED: Wrong exception: %', SQLERRM;
    END IF;
END $$;

-- ==============================================================================
-- Test Cleanup (测试清理 - 仅在需要时运行)
-- ==============================================================================

/*
-- Delete all test data (for rerunning tests)
DELETE FROM service_ledgers WHERE student_id = 'test-student-001';
DELETE FROM service_holds WHERE student_id = 'test-student-001';
DELETE FROM contract_amendment_ledgers WHERE student_id = 'test-student-001';
DELETE FROM contract_service_entitlements WHERE student_id = 'test-student-001';
DELETE FROM contracts WHERE student_id = 'test-student-001';
DELETE FROM product_items WHERE product_id = 'test-product-001';
DELETE FROM products WHERE id = 'test-product-001';
DELETE FROM services WHERE id = 'test-service-001';
DELETE FROM "user" WHERE id IN ('test-student-001', 'test-mentor-001');
*/

-- ==============================================================================
-- Test Summary Query (测试总结查询)
-- ==============================================================================

-- Verify all test data
SELECT
  'contract_service_entitlements' as table_name,
  COUNT(*) as record_count
FROM contract_service_entitlements
WHERE student_id = 'test-student-001'

UNION ALL

SELECT
  'service_ledgers',
  COUNT(*)
FROM service_ledgers
WHERE student_id = 'test-student-001'

UNION ALL

SELECT
  'service_holds',
  COUNT(*)
FROM service_holds
WHERE student_id = 'test-student-001'

UNION ALL

SELECT
  'contract_amendment_ledgers',
  COUNT(*)
FROM contract_amendment_ledgers
WHERE student_id = 'test-student-001'

UNION ALL

SELECT
  'contracts',
  COUNT(*)
FROM contracts
WHERE student_id = 'test-student-001';

-- ==============================================================================
-- End of Test Script
-- ==============================================================================
