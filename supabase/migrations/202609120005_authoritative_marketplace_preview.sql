begin;

create function public.read_marketplace_pricing_preview(
  p_community_id uuid,
  p_market_interval_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  interval_row public.market_intervals;
  tariff_row public.tariff_configs;
  feeder_row public.feeder_snapshots;
  community_currency text;
  supply_kwh numeric;
  demand_kwh numeric;
  highest_seller_minimum numeric;
  lowest_buyer_maximum numeric;
begin
  if not private.is_active_member(p_community_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select *
  into strict interval_row
  from public.market_intervals
  where community_id = p_community_id
    and id = p_market_interval_id;

  select currency
  into strict community_currency
  from public.communities
  where id = p_community_id;

  select *
  into tariff_row
  from public.tariff_configs
  where community_id = p_community_id
    and effective_from <= interval_row.interval_start
    and (effective_to is null or effective_to > interval_row.interval_start)
  order by effective_from desc, id desc
  limit 1;

  select *
  into feeder_row
  from public.feeder_snapshots
  where community_id = p_community_id
    and market_interval_id = p_market_interval_id
  order by observed_at desc, id desc
  limit 1;

  select coalesce(sum(remaining_kwh), 0), max(minimum_price)
  into supply_kwh, highest_seller_minimum
  from public.offers
  where community_id = p_community_id
    and market_interval_id = p_market_interval_id
    and status in ('open', 'partly_matched')
    and remaining_kwh > 0;

  select coalesce(sum(remaining_kwh), 0), min(maximum_price)
  into demand_kwh, lowest_buyer_maximum
  from public.reservations
  where community_id = p_community_id
    and market_interval_id = p_market_interval_id
    and status in ('active', 'partly_matched')
    and remaining_kwh > 0;

  return private.calculate_interval_price(
    community_currency,
    tariff_row.feed_in_rate,
    tariff_row.retail_rate,
    tariff_row.seller_margin_ratio,
    tariff_row.buyer_discount_ratio,
    supply_kwh,
    demand_kwh,
    feeder_row.congestion_ratio,
    highest_seller_minimum,
    lowest_buyer_maximum
  );
end;
$$;

comment on function public.read_marketplace_pricing_preview(uuid, uuid) is
  'Calculates a member visible price preview from every active order in an interval.';

revoke execute on function public.read_marketplace_pricing_preview(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.read_marketplace_pricing_preview(uuid, uuid)
  to authenticated;

commit;
