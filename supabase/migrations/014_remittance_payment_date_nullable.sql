-- Allow remittance imports without a payment date column (e.g. Axia commission reports).
alter table remittance alter column payment_date drop not null;
