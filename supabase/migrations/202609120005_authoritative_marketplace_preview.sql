begin;

create function private.aggregate_interval_orders(
  p_community_id uuid,
  p_market_interval_id uuid
)
returns table (
  supply_kwh numeric,
  demand_kwh numeric,
  highest_seller_minimum numeric,
  lowest_buyer_maximum numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    offer_aggregates.supply_kwh,
    reservation_aggregates.demand_kwh,
    offer_aggregates.highest_seller_minimum,
    reservation_aggregates.lowest_buyer_maximum
  from (
    select
      coalesce(sum(remaining_kwh), 0) as supply_kwh,
      max(minimum_price) as highest_seller_minimum
    from public.offers
    where community_id = p_community_id
      and market_interval_id = p_market_interval_id
      and status in ('open', 'partly_matched')
      and remaining_kwh > 0
  ) as offer_aggregates
  cross join (
    select
      coalesce(sum(remaining_kwh), 0) as demand_kwh,
      min(maximum_price) as lowest_buyer_maximum
    from public.reservations
    where community_id = p_community_id
      and market_interval_id = p_market_interval_id
      and status in ('active', 'partly_matched')
      and remaining_kwh > 0
  ) as reservation_aggregates;
$$;

comment on function private.aggregate_interval_orders(uuid, uuid) is
  'Aggregates the active offer and reservation quantities and limits for one market interval.';

revoke execute on function private.aggregate_interval_orders(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.create_pricing_snapshot(
  p_community_id uuid,
  p_market_interval_id uuid
)
returns jsonb
language plpgsql
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
  calculated jsonb;
  snapshot_row public.pricing_snapshots;
begin
  perform pg_advisory_xact_lock(hashtextextended('solarshare:' || p_community_id::text, 0));

  select *
  into strict interval_row
  from public.market_intervals
  where community_id = p_community_id and id = p_market_interval_id
  for update;

  if interval_row.status not in ('open', 'matching') then
    raise exception 'interval is not eligible for pricing' using errcode = '55000';
  end if;

  perform id
  from public.offers
  where community_id = p_community_id
    and market_interval_id = p_market_interval_id
    and status in ('open', 'partly_matched')
    and remaining_kwh > 0
  order by id
  for update;

  perform id
  from public.reservations
  where community_id = p_community_id
    and market_interval_id = p_market_interval_id
    and status in ('active', 'partly_matched')
    and remaining_kwh > 0
  order by id
  for update;

  select currency into strict community_currency
  from public.communities
  where id = p_community_id;

  select * into tariff_row
  from public.tariff_configs
  where community_id = p_community_id
    and effective_from <= interval_row.interval_start
    and (effective_to is null or effective_to > interval_row.interval_start)
  order by effective_from desc, id desc
  limit 1;

  select * into feeder_row
  from public.feeder_snapshots
  where community_id = p_community_id
    and market_interval_id = p_market_interval_id
  order by observed_at desc, id desc
  limit 1;

  select
    aggregated.supply_kwh,
    aggregated.demand_kwh,
    aggregated.highest_seller_minimum,
    aggregated.lowest_buyer_maximum
  into
    supply_kwh,
    demand_kwh,
    highest_seller_minimum,
    lowest_buyer_maximum
  from private.aggregate_interval_orders(
    p_community_id,
    p_market_interval_id
  ) as aggregated;

  calculated := private.calculate_interval_price(
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

  if calculated ->> 'outcome' = 'invalid_tariff' then
    update public.market_intervals
    set status = 'paused'
    where community_id = p_community_id and id = p_market_interval_id;
  elsif calculated ->> 'outcome' = 'priced' then
    insert into public.pricing_snapshots(
      community_id,
      market_interval_id,
      tariff_config_id,
      feeder_snapshot_id,
      algorithm_version,
      supply_kwh,
      demand_kwh,
      unit_price,
      explanation,
      scenario_generation_id
    ) values (
      p_community_id,
      p_market_interval_id,
      tariff_row.id,
      feeder_row.id,
      calculated ->> 'algorithmVersion',
      supply_kwh,
      demand_kwh,
      (calculated ->> 'unitPrice')::numeric,
      calculated -> 'explanation',
      interval_row.scenario_generation_id
    ) returning * into snapshot_row;
  end if;

  return calculated || jsonb_build_object(
    'schemaVersion', '1',
    'pricingSnapshotId', snapshot_row.id,
    'communityId', p_community_id,
    'marketIntervalId', p_market_interval_id,
    'tariffConfigId', tariff_row.id,
    'feederSnapshotId', feeder_row.id,
    'supplyKwh', to_char(supply_kwh, 'FM999999999999990.000000'),
    'demandKwh', to_char(demand_kwh, 'FM999999999999990.000000')
  );
end;
$$;

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

  select
    aggregated.supply_kwh,
    aggregated.demand_kwh,
    aggregated.highest_seller_minimum,
    aggregated.lowest_buyer_maximum
  into
    supply_kwh,
    demand_kwh,
    highest_seller_minimum,
    lowest_buyer_maximum
  from private.aggregate_interval_orders(
    p_community_id,
    p_market_interval_id
  ) as aggregated;

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
