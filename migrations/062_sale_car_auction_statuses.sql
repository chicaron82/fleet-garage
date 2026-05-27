-- Migration 062: Add SALE_CAR and AUCTION_SHORT_TERM vehicle statuses
-- Required by: Sale Car hold type + Auction short term release (ticket 2)
-- Run against Supabase before deploying the matching frontend changes.

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_status_check;

-- Fix one legacy row with truncated status value
UPDATE vehicles SET status = 'OUT_ON_EXCEPTION' WHERE status = 'ON_EXCEPTION';

ALTER TABLE vehicles ADD CONSTRAINT vehicles_status_check
  CHECK (status IN (
    'CLEAR',
    'HELD',
    'PRE_EXISTING',
    'OUT_ON_EXCEPTION',
    'RETURNED',
    'SALE_CAR',
    'AUCTION_SHORT_TERM'
  ));
