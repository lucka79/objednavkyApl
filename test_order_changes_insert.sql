-- Test script to verify order changes are being tracked
-- Run this in your Supabase SQL editor

-- 1. Check if there are any recent order changes
SELECT 
  oc.*,
  p.full_name as user_name,
  p.role as user_role
FROM order_changes oc
LEFT JOIN profiles p ON oc.user_id = p.id
WHERE oc.order_id = 14225
ORDER BY oc.created_at DESC
LIMIT 10;

-- 2. Test the trigger by making a small change to an order
-- This should create a new record in order_changes
UPDATE orders 
SET note = 'Test trigger - ' || now() 
WHERE id = 14225;

-- 3. Check if the change was recorded
SELECT 
  oc.*,
  p.full_name as user_name,
  p.role as user_role
FROM order_changes oc
LEFT JOIN profiles p ON oc.user_id = p.id
WHERE oc.order_id = 14225
ORDER BY oc.created_at DESC
LIMIT 5;

-- 4. Test crate change tracking
UPDATE orders 
SET "crateSmall" = COALESCE("crateSmall", 0) + 1
WHERE id = 14225;

-- 5. Check if the crate change was recorded
SELECT 
  oc.*,
  p.full_name as user_name,
  p.role as user_role
FROM order_changes oc
LEFT JOIN profiles p ON oc.user_id = p.id
WHERE oc.order_id = 14225
  AND oc.change_type LIKE '%crate%'
ORDER BY oc.created_at DESC
LIMIT 5;
