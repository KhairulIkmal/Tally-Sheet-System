-- Tally Sheet: header fields are optional (decided 2026-10-22).
--
-- Warehouse workers sometimes don't have the contract, seal, SI or D/O
-- number at the dock, and the paper sheet never forced them to fill every
-- box. The app no longer requires them, so the table stops requiring them
-- too. sheet_date stays NOT NULL: a blank date is sent as today.
--
-- Rollback: re-add the two checks from 20261015000000_tally_sheet_schema.sql
-- (only once no submitted sheet has a blank header field).

alter table tally.sheets drop constraint if exists sheets_container_header;
alter table tally.sheets drop constraint if exists sheets_lorry_header;
