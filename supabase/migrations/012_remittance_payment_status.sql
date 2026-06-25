-- Rep/installer payment milestone label (e.g. M1 Paid, M2 Payable).
-- Distinct from `status`, which is install/deal stage from the remittance file.

alter table remittance add column if not exists payment_status text;
