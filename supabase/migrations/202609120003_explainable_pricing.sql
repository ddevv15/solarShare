create function private.calculate_interval_price(
  p_currency text,
  p_feed_in_rate numeric,
  p_retail_rate numeric,
  p_seller_margin_ratio numeric,
  p_buyer_discount_ratio numeric,
  p_supply_kwh numeric,
  p_demand_kwh numeric,
  p_congestion_ratio numeric,
  p_highest_seller_minimum numeric,
  p_lowest_buyer_maximum numeric
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  algorithm_version constant text := 'linear-pressure-v1';
  explanation_version constant text := '1';
  spread numeric;
  midpoint numeric;
  tariff_lower numeric;
  tariff_upper numeric;
  lower_bound numeric;
  upper_bound numeric;
  market_pressure numeric;
  congestion_pressure numeric;
  combined_pressure numeric;
  unclamped_price numeric;
  rounded_price numeric;
  unit_price numeric;
  clamp_direction text := 'none';
  binding_limit text := 'none';
  summary text;
  tariff_json jsonb;
  market_json jsonb;
  congestion_json jsonb;
  limits_json jsonb;
begin
  market_json := jsonb_build_object(
    'supplyKwh', to_char(coalesce(p_supply_kwh, 0), 'FM999999999999990.000000'),
    'demandKwh', to_char(coalesce(p_demand_kwh, 0), 'FM999999999999990.000000'),
    'pressure', '0.000000'
  );

  if p_feed_in_rate is null
    or p_retail_rate is null
    or p_seller_margin_ratio is null
    or p_buyer_discount_ratio is null
    or p_feed_in_rate < 0
    or p_retail_rate < 0
    or p_feed_in_rate >= p_retail_rate
    or p_seller_margin_ratio < 0
    or p_seller_margin_ratio > 1
    or p_buyer_discount_ratio < 0
    or p_buyer_discount_ratio > 1 then
    return jsonb_build_object(
      'algorithmVersion', algorithm_version,
      'outcome', 'invalid_tariff',
      'unitPrice', null,
      'explanation', jsonb_build_object(
        'schemaVersion', explanation_version,
        'summary', 'No price was created because the tariff configuration is invalid: tariff values are missing or outside their allowed ranges. The interval is paused for an operator to correct it.',
        'outcome', 'invalid_tariff',
        'currency', p_currency,
        'tariff', null,
        'market', market_json,
        'congestion', null,
        'limits', null,
        'calculation', null,
        'reason', 'tariff_values_out_of_range'
      )
    );
  end if;

  spread := p_retail_rate - p_feed_in_rate;
  midpoint := (p_feed_in_rate + p_retail_rate) / 2;
  tariff_lower := p_feed_in_rate + spread * p_seller_margin_ratio;
  tariff_upper := p_retail_rate - spread * p_buyer_discount_ratio;
  tariff_json := jsonb_build_object(
    'feedInRate', to_char(p_feed_in_rate, 'FM999999999999990.000000'),
    'retailRate', to_char(p_retail_rate, 'FM999999999999990.000000'),
    'midpoint', to_char(midpoint, 'FM999999999999990.000000'),
    'protectedLowerBound', to_char(tariff_lower, 'FM999999999999990.000000'),
    'protectedUpperBound', to_char(tariff_upper, 'FM999999999999990.000000')
  );

  if tariff_lower > tariff_upper then
    return jsonb_build_object(
      'algorithmVersion', algorithm_version,
      'outcome', 'invalid_tariff',
      'unitPrice', null,
      'explanation', jsonb_build_object(
        'schemaVersion', explanation_version,
        'summary', 'No price was created because the tariff configuration is invalid: the seller and buyer tariff protections cross. The interval is paused for an operator to correct it.',
        'outcome', 'invalid_tariff',
        'currency', p_currency,
        'tariff', tariff_json,
        'market', market_json,
        'congestion', null,
        'limits', null,
        'calculation', null,
        'reason', 'tariff_protections_cross'
      )
    );
  end if;

  if p_congestion_ratio is null then
    return jsonb_build_object(
      'algorithmVersion', algorithm_version,
      'outcome', 'missing_input',
      'unitPrice', null,
      'explanation', jsonb_build_object(
        'schemaVersion', explanation_version,
        'summary', 'No price was created because feeder congestion data is missing.',
        'outcome', 'missing_input',
        'currency', p_currency,
        'tariff', tariff_json,
        'market', market_json,
        'congestion', null,
        'limits', null,
        'calculation', null,
        'reason', 'missing_feeder'
      )
    );
  end if;

  if p_congestion_ratio < 0 or p_congestion_ratio > 1 then
    raise exception 'congestion ratio must be between zero and one' using errcode = '22023';
  end if;

  if coalesce(p_supply_kwh, 0) <= 0 or coalesce(p_demand_kwh, 0) <= 0 then
    return jsonb_build_object(
      'algorithmVersion', algorithm_version,
      'outcome', 'missing_input',
      'unitPrice', null,
      'explanation', jsonb_build_object(
        'schemaVersion', explanation_version,
        'summary', case when coalesce(p_supply_kwh, 0) <= 0
          then 'No price was created because there is no active local supply.'
          else 'No price was created because there is no active local demand.' end,
        'outcome', 'missing_input',
        'currency', p_currency,
        'tariff', tariff_json,
        'market', market_json,
        'congestion', null,
        'limits', null,
        'calculation', null,
        'reason', case when coalesce(p_supply_kwh, 0) <= 0 then 'missing_supply' else 'missing_demand' end
      )
    );
  end if;

  lower_bound := greatest(tariff_lower, coalesce(p_highest_seller_minimum, tariff_lower));
  upper_bound := least(tariff_upper, coalesce(p_lowest_buyer_maximum, tariff_upper));
  congestion_pressure := case
    when p_congestion_ratio <= 0.5 then 0
    else (p_congestion_ratio - 0.5) / 0.5
  end;
  congestion_json := jsonb_build_object(
    'ratio', to_char(p_congestion_ratio, 'FM999999999999990.000000'),
    'threshold', '0.500000',
    'pressure', to_char(congestion_pressure, 'FM999999999999990.000000')
  );
  limits_json := jsonb_build_object(
    'highestSellerMinimum', case when p_highest_seller_minimum is null then null else to_char(p_highest_seller_minimum, 'FM999999999999990.000000') end,
    'lowestBuyerMaximum', case when p_lowest_buyer_maximum is null then null else to_char(p_lowest_buyer_maximum, 'FM999999999999990.000000') end,
    'effectiveLowerBound', to_char(lower_bound, 'FM999999999999990.000000'),
    'effectiveUpperBound', to_char(upper_bound, 'FM999999999999990.000000'),
    'bindingLimit', 'none'
  );

  if lower_bound > upper_bound then
    if p_highest_seller_minimum is not null and p_lowest_buyer_maximum is not null then
      summary := format(
        'No price was created because the highest seller minimum of %s %s per kWh is above the lowest buyer maximum of %s %s per kWh. Users can revise their orders.',
        p_currency,
        to_char(p_highest_seller_minimum, 'FM999999999999990.000000'),
        p_currency,
        to_char(p_lowest_buyer_maximum, 'FM999999999999990.000000')
      );
    else
      summary := format(
        'No price was created because the effective lower limit of %s %s per kWh is above the effective upper limit of %s %s per kWh. Users can revise their orders.',
        p_currency,
        to_char(lower_bound, 'FM999999999999990.000000'),
        p_currency,
        to_char(upper_bound, 'FM999999999999990.000000')
      );
    end if;
    return jsonb_build_object(
      'algorithmVersion', algorithm_version,
      'outcome', 'no_common_limit',
      'unitPrice', null,
      'explanation', jsonb_build_object(
        'schemaVersion', explanation_version,
        'summary', summary,
        'outcome', 'no_common_limit',
        'currency', p_currency,
        'tariff', tariff_json,
        'market', market_json,
        'congestion', congestion_json,
        'limits', limits_json,
        'calculation', null,
        'reason', 'order_limits_do_not_overlap'
      )
    );
  end if;

  market_pressure := (p_demand_kwh - p_supply_kwh) / (p_demand_kwh + p_supply_kwh);
  combined_pressure := greatest(-1, least(1, 0.75 * market_pressure + 0.25 * congestion_pressure));
  unclamped_price := midpoint + combined_pressure * spread / 2;
  rounded_price := round(unclamped_price, 6);
  unit_price := greatest(lower_bound, least(upper_bound, rounded_price));

  if rounded_price < lower_bound then
    clamp_direction := 'lower';
    binding_limit := case
      when p_highest_seller_minimum is not null and p_highest_seller_minimum >= tariff_lower then 'seller_minimum'
      else 'tariff_seller_protection'
    end;
  elsif rounded_price > upper_bound then
    clamp_direction := 'upper';
    binding_limit := case
      when p_lowest_buyer_maximum is not null and p_lowest_buyer_maximum <= tariff_upper then 'buyer_maximum'
      else 'tariff_buyer_protection'
    end;
  end if;

  limits_json := limits_json || jsonb_build_object('bindingLimit', binding_limit);
  summary := case binding_limit
    when 'seller_minimum' then format('The price is %s %s per kWh because the highest seller minimum held it at that lower limit.', p_currency, to_char(unit_price, 'FM999999999999990.000000'))
    when 'buyer_maximum' then format('The price is %s %s per kWh because the lowest buyer maximum held it at that upper limit.', p_currency, to_char(unit_price, 'FM999999999999990.000000'))
    when 'tariff_seller_protection' then format('The price is %s %s per kWh because the tariff seller protection set the lower limit.', p_currency, to_char(unit_price, 'FM999999999999990.000000'))
    when 'tariff_buyer_protection' then format('The price is %s %s per kWh because the tariff buyer protection set the upper limit.', p_currency, to_char(unit_price, 'FM999999999999990.000000'))
    else case
      when market_pressure = 0 and congestion_pressure = 0 then format('Local supply matches demand and grid import is below the congestion threshold, so the price stays at the tariff midpoint of %s %s per kWh.', p_currency, to_char(unit_price, 'FM999999999999990.000000'))
      else format('Local supply, demand, and grid import pressure set the price at %s %s per kWh.', p_currency, to_char(unit_price, 'FM999999999999990.000000'))
    end
  end;

  return jsonb_build_object(
    'algorithmVersion', algorithm_version,
    'outcome', 'priced',
    'unitPrice', to_char(unit_price, 'FM999999999999990.000000'),
    'explanation', jsonb_build_object(
      'schemaVersion', explanation_version,
      'summary', summary,
      'outcome', 'priced',
      'currency', p_currency,
      'tariff', tariff_json,
      'market', jsonb_build_object(
        'supplyKwh', to_char(p_supply_kwh, 'FM999999999999990.000000'),
        'demandKwh', to_char(p_demand_kwh, 'FM999999999999990.000000'),
        'pressure', to_char(market_pressure, 'FM999999999999990.000000')
      ),
      'congestion', congestion_json,
      'limits', limits_json,
      'calculation', jsonb_build_object(
        'unclampedPrice', to_char(unclamped_price, 'FM999999999999990.000000'),
        'roundedPrice', to_char(rounded_price, 'FM999999999999990.000000'),
        'finalPrice', to_char(unit_price, 'FM999999999999990.000000'),
        'clampDirection', clamp_direction
      ),
      'reason', null
    )
  );
end;
$$;

create function public.create_pricing_snapshot(
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

comment on function public.create_pricing_snapshot(uuid, uuid) is
  'Calculates and appends one explainable interval price for trusted market work.';

revoke execute on function private.calculate_interval_price(text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric)
  from public, anon, authenticated, service_role;
revoke execute on function public.create_pricing_snapshot(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.create_pricing_snapshot(uuid, uuid)
  to service_role;
