-- Khan Blocks: titles (цол) are now the ranks of a khan's army instead of wrestling titles.
-- Same thresholds and letters as before (and as TITLES in src/js/11-ranks.js); only the names change.
-- `create or replace` keeps the function's signature, volatility and privileges (the leaderboard view uses it).
-- title_index() stays numeric (0-7) and needs no change; nothing compares title text.
create or replace function public.rank_title(r integer) returns text
language sql immutable as $$
  select case
    when r >= 2000 then 'Их хаан' when r >= 1850 then 'Хаан'   when r >= 1700 then 'Жанжин'
    when r >= 1400 then 'Түмэн'   when r >= 1175 then 'Мянгат' when r >= 950  then 'Зуут'
    when r >= 725  then 'Аравт'   else 'Цэрэг' end
$$;
