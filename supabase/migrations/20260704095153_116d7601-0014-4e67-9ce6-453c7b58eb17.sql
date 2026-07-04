
-- Delete duplicate free-investment claims (keep the earliest per user+investment)
DELETE FROM public.user_investments ui
USING public.investments i
WHERE ui.investment_id = i.id
  AND i.price = 0
  AND ui.id NOT IN (
    SELECT DISTINCT ON (ui2.user_id, ui2.investment_id) ui2.id
    FROM public.user_investments ui2
    JOIN public.investments i2 ON i2.id = ui2.investment_id
    WHERE i2.price = 0
    ORDER BY ui2.user_id, ui2.investment_id, ui2.purchased_at ASC
  );

-- Partial unique index: at most one claim per (user, free-investment)
CREATE UNIQUE INDEX IF NOT EXISTS user_investments_unique_free_claim
  ON public.user_investments (user_id, investment_id)
  WHERE price_paid = 0;
