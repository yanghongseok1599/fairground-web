-- Keep the existing numeric and label columns; preserve all registered values.
-- Accept exactly 1–3 ASCII digits, including 0, 00, 000, 01 and 007.
-- NULL labels remain compatible with previously registered numeric-only shirts.
ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_zero_number_label,
  ADD CONSTRAINT profiles_jersey_number_label CHECK (
    number BETWEEN 0 AND 999
    AND (number_label IS NULL OR CASE
      WHEN number_label ~ '^[0-9]{1,3}$' THEN number = number_label::integer
      ELSE false
    END)
  );

ALTER TABLE public.match_lineups
  DROP CONSTRAINT lineups_zero_number_label,
  ADD CONSTRAINT lineups_jersey_number_label CHECK (
    (jersey_number IS NULL OR jersey_number BETWEEN 0 AND 999)
    AND (jersey_number_label IS NULL OR CASE
      WHEN jersey_number_label ~ '^[0-9]{1,3}$'
        THEN jersey_number IS NOT NULL AND jersey_number = jersey_number_label::integer
      ELSE false
    END)
  );
