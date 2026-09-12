begin;

-- Submission is one database transaction. The draft insert, owner transition,
-- and completed idempotency record either commit together or all roll back.
-- Replaying the same operation and semantic inputs returns the original row id.
create function public.submit_offer(
  p_community_id uuid,
  p_market_interval_id uuid,
  p_solar_asset_id uuid,
  p_forecast_id uuid,
  p_quantity_kwh numeric,
  p_minimum_price numeric,
  p_is_manual_quantity boolean,
  p_auto_adjust boolean,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation_name constant text := 'offer.submit.v1';
  actor_id uuid;
  request_hash text;
  prior public.idempotency_records;
  interval_row public.market_intervals;
  offer_id uuid;
begin
  actor_id := (select auth.uid());
  if actor_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;
  if btrim(coalesce(p_idempotency_key, '')) = '' then
    raise exception 'idempotency key is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('solarshare:' || p_community_id::text, 0)
  );
  request_hash := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'actorId', actor_id,
          'autoAdjust', p_auto_adjust,
          'communityId', p_community_id,
          'forecastId', p_forecast_id,
          'intervalId', p_market_interval_id,
          'isManualQuantity', p_is_manual_quantity,
          'minimumPrice', p_minimum_price,
          'quantityKwh', p_quantity_kwh,
          'solarAssetId', p_solar_asset_id
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  select *
  into prior
  from public.idempotency_records
  where community_id = p_community_id
    and operation = operation_name
    and idempotency_key = p_idempotency_key;

  if found then
    if prior.request_sha256 <> request_hash then
      raise exception 'idempotency conflict' using errcode = '23505';
    end if;
    if prior.status <> 'completed' or prior.result ->> 'offerId' is null then
      raise exception 'prior offer submission did not complete'
        using errcode = '55000';
    end if;
    return (prior.result ->> 'offerId')::uuid;
  end if;

  if not exists (
    select 1
    from public.community_members
    where community_id = p_community_id
      and user_id = actor_id
      and member_role = 'household'
      and status = 'active'
  ) then
    raise exception 'active household membership is required'
      using errcode = '42501';
  end if;

  select *
  into interval_row
  from public.market_intervals
  where id = p_market_interval_id
    and community_id = p_community_id
  for update;
  if not found or interval_row.status <> 'open' then
    raise exception 'market interval is not open' using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.energy_assets
    where id = p_solar_asset_id
      and community_id = p_community_id
      and owner_user_id = actor_id
      and asset_type = 'solar'
      and status = 'active'
  ) then
    raise exception 'active owned solar asset is required'
      using errcode = '42501';
  end if;

  if p_forecast_id is not null and not exists (
    select 1
    from public.forecasts
    where id = p_forecast_id
      and community_id = p_community_id
      and market_interval_id = p_market_interval_id
      and asset_id = p_solar_asset_id
      and metric = 'surplus'
  ) then
    raise exception 'offer forecast does not match the interval and asset'
      using errcode = '23514';
  end if;

  offer_id := gen_random_uuid();
  insert into public.offers(
    id,
    community_id,
    market_interval_id,
    seller_user_id,
    solar_asset_id,
    forecast_id,
    quantity_kwh,
    remaining_kwh,
    minimum_price,
    is_manual_quantity,
    auto_adjust,
    status
  )
  values (
    offer_id,
    p_community_id,
    p_market_interval_id,
    actor_id,
    p_solar_asset_id,
    p_forecast_id,
    p_quantity_kwh,
    p_quantity_kwh,
    p_minimum_price,
    p_is_manual_quantity,
    p_auto_adjust,
    'draft'
  );
  update public.offers set status = 'open' where id = offer_id;

  insert into public.idempotency_records(
    community_id,
    actor_user_id,
    operation,
    idempotency_key,
    request_sha256,
    status,
    result_version,
    result,
    completed_at
  )
  values (
    p_community_id,
    actor_id,
    operation_name,
    p_idempotency_key,
    request_hash,
    'completed',
    '1',
    jsonb_build_object('offerId', offer_id),
    statement_timestamp()
  );

  return offer_id;
end;
$$;

create function public.submit_reservation(
  p_community_id uuid,
  p_market_interval_id uuid,
  p_quantity_kwh numeric,
  p_maximum_price numeric,
  p_auto_adjust boolean,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation_name constant text := 'reservation.submit.v1';
  actor_id uuid;
  request_hash text;
  prior public.idempotency_records;
  interval_row public.market_intervals;
  reservation_id uuid;
begin
  actor_id := (select auth.uid());
  if actor_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;
  if btrim(coalesce(p_idempotency_key, '')) = '' then
    raise exception 'idempotency key is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('solarshare:' || p_community_id::text, 0)
  );
  request_hash := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'actorId', actor_id,
          'autoAdjust', p_auto_adjust,
          'communityId', p_community_id,
          'intervalId', p_market_interval_id,
          'maximumPrice', p_maximum_price,
          'quantityKwh', p_quantity_kwh
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  select *
  into prior
  from public.idempotency_records
  where community_id = p_community_id
    and operation = operation_name
    and idempotency_key = p_idempotency_key;

  if found then
    if prior.request_sha256 <> request_hash then
      raise exception 'idempotency conflict' using errcode = '23505';
    end if;
    if prior.status <> 'completed'
      or prior.result ->> 'reservationId' is null then
      raise exception 'prior reservation submission did not complete'
        using errcode = '55000';
    end if;
    return (prior.result ->> 'reservationId')::uuid;
  end if;

  if not exists (
    select 1
    from public.community_members
    where community_id = p_community_id
      and user_id = actor_id
      and member_role = 'household'
      and status = 'active'
  ) then
    raise exception 'active household membership is required'
      using errcode = '42501';
  end if;

  select *
  into interval_row
  from public.market_intervals
  where id = p_market_interval_id
    and community_id = p_community_id
  for update;
  if not found or interval_row.status <> 'open' then
    raise exception 'market interval is not open' using errcode = '55000';
  end if;

  reservation_id := gen_random_uuid();
  insert into public.reservations(
    id,
    community_id,
    market_interval_id,
    buyer_user_id,
    quantity_kwh,
    remaining_kwh,
    maximum_price,
    auto_adjust,
    status
  )
  values (
    reservation_id,
    p_community_id,
    p_market_interval_id,
    actor_id,
    p_quantity_kwh,
    p_quantity_kwh,
    p_maximum_price,
    p_auto_adjust,
    'pending'
  );
  update public.reservations set status = 'active' where id = reservation_id;

  insert into public.idempotency_records(
    community_id,
    actor_user_id,
    operation,
    idempotency_key,
    request_sha256,
    status,
    result_version,
    result,
    completed_at
  )
  values (
    p_community_id,
    actor_id,
    operation_name,
    p_idempotency_key,
    request_hash,
    'completed',
    '1',
    jsonb_build_object('reservationId', reservation_id),
    statement_timestamp()
  );

  return reservation_id;
end;
$$;

revoke execute on function public.submit_offer(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  numeric,
  boolean,
  boolean,
  text
) from public, anon, authenticated, service_role;
revoke execute on function public.submit_reservation(
  uuid,
  uuid,
  numeric,
  numeric,
  boolean,
  text
) from public, anon, authenticated, service_role;

grant execute on function public.submit_offer(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  numeric,
  boolean,
  boolean,
  text
) to authenticated;
grant execute on function public.submit_reservation(
  uuid,
  uuid,
  numeric,
  numeric,
  boolean,
  text
) to authenticated;

commit;
