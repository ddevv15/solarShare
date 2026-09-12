begin;

select set_config('solarshare.trusted_write', 'on', true);

-- GoTrue scans its token columns into non-nullable Go strings, so a seeded
-- auth.users row that leaves them null breaks every Auth query touching it:
-- sign-in returns 500 "Database error querying schema" and the admin user list
-- returns 500 "Database error finding users". They must be empty string.
do $$
declare
  origin timestamptz := ('2026-09-12 00:00:00'::timestamp at time zone 'Asia/Kolkata');
  generation_id uuid := private.seed_uuid('1', 'generation', '10000000-0000-4000-8000-000000000001:2026-09-13');
  demo_community constant uuid := '10000000-0000-4000-8000-000000000001';
  demo_user_ids constant uuid[] := array[
    '20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000006'
  ]::uuid[];
  expectation record;
  actual bigint;
  person record;
begin
  for person in
    select * from (values
      ('20000000-0000-4000-8000-000000000001'::uuid, 'operator@solarshare.local', 'Mira Operator', null::numeric, null::numeric, 'operator', 'Grid Guide'),
      ('20000000-0000-4000-8000-000000000002'::uuid, 'seller@solarshare.local', 'Asha Solar Home', 12.930000, 77.580000, 'household', 'Sun Home'),
      ('20000000-0000-4000-8000-000000000003'::uuid, 'buyer1@solarshare.local', 'Ravi Buyer', 12.920000, 77.570000, 'household', 'Lotus Home'),
      ('20000000-0000-4000-8000-000000000004'::uuid, 'buyer2@solarshare.local', 'Leela Buyer', 12.940000, 77.570000, 'household', 'Mango Home'),
      ('20000000-0000-4000-8000-000000000005'::uuid, 'buyer3@solarshare.local', 'Noor Buyer', 12.920000, 77.590000, 'household', 'Neem Home'),
      ('20000000-0000-4000-8000-000000000006'::uuid, 'buyer4@solarshare.local', 'Kabir Buyer', 12.940000, 77.590000, 'household', 'River Home')
    ) as users(id, email, display_name, latitude_approx, longitude_approx, member_role, market_alias)
  loop
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,is_sso_user,is_anonymous,created_at,updated_at,confirmation_token,recovery_token,email_change,email_change_token_new,email_change_token_current,phone_change,phone_change_token,reauthentication_token)
    values('00000000-0000-0000-0000-000000000000',person.id,'authenticated','authenticated',person.email,null,origin,jsonb_build_object('provider','email','providers',array['email']),jsonb_build_object('display_name',person.display_name),false,false,origin,origin,'','','','','','','','')
    on conflict (id) do update set email=excluded.email,raw_app_meta_data=excluded.raw_app_meta_data,raw_user_meta_data=excluded.raw_user_meta_data,updated_at=excluded.updated_at;

    insert into auth.identities(id,provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
    values(private.seed_uuid('1','auth_identity',person.id::text),person.email,person.id,jsonb_build_object('sub',person.id,'email',person.email),'email',origin,origin,origin)
    on conflict (provider_id,provider) do update set user_id=excluded.user_id,identity_data=excluded.identity_data,updated_at=excluded.updated_at;

    insert into public.profiles(id,display_name,latitude_approx,longitude_approx,timezone,created_at,updated_at)
    values(person.id,person.display_name,person.latitude_approx,person.longitude_approx,'Asia/Kolkata',origin,origin)
    on conflict (id) do update set display_name=excluded.display_name,latitude_approx=excluded.latitude_approx,longitude_approx=excluded.longitude_approx,timezone=excluded.timezone;
  end loop;

  insert into public.communities(id,name,timezone,currency,status,demo_seed_key,seed_version,created_at,updated_at)
  values('10000000-0000-4000-8000-000000000001','SolarShare Bengaluru Demo','Asia/Kolkata','INR','active','solarshare-demo-v1','1',origin,origin)
  on conflict (id) do update set name=excluded.name,timezone=excluded.timezone,currency=excluded.currency,status=excluded.status,demo_seed_key=excluded.demo_seed_key,seed_version=excluded.seed_version;

  insert into public.community_members(community_id,user_id,member_role,status,market_alias,joined_at,updated_at)
  select '10000000-0000-4000-8000-000000000001', id, member_role, 'active', market_alias, origin, origin
  from (values
    ('20000000-0000-4000-8000-000000000001'::uuid,'operator','Grid Guide'),
    ('20000000-0000-4000-8000-000000000002'::uuid,'household','Sun Home'),
    ('20000000-0000-4000-8000-000000000003'::uuid,'household','Lotus Home'),
    ('20000000-0000-4000-8000-000000000004'::uuid,'household','Mango Home'),
    ('20000000-0000-4000-8000-000000000005'::uuid,'household','Neem Home'),
    ('20000000-0000-4000-8000-000000000006'::uuid,'household','River Home')
  ) as members(id,member_role,market_alias)
  on conflict (community_id,user_id) do update set member_role=excluded.member_role,status=excluded.status,market_alias=excluded.market_alias;

  insert into public.credit_accounts(id,community_id,owner_user_id,currency,status,created_at)
  select private.seed_uuid('1','account',id::text),'10000000-0000-4000-8000-000000000001',id,'INR','active',origin
  from (values
    ('20000000-0000-4000-8000-000000000001'::uuid),('20000000-0000-4000-8000-000000000002'::uuid),('20000000-0000-4000-8000-000000000003'::uuid),
    ('20000000-0000-4000-8000-000000000004'::uuid),('20000000-0000-4000-8000-000000000005'::uuid),('20000000-0000-4000-8000-000000000006'::uuid)
  ) as users(id) on conflict (community_id,owner_user_id,currency) do nothing;

  insert into public.energy_assets(id,community_id,owner_user_id,asset_type,name,capacity_kw,tilt_degrees,azimuth_degrees,reserve_kwh,status,created_at,updated_at) values
    ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','solar','Asha Rooftop Solar',5,12,180,0.2,'active',origin,origin),
    ('30000000-0000-4000-8000-000000000101','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','meter','Sun Home Meter',10,null,null,0,'active',origin,origin),
    ('30000000-0000-4000-8000-000000000102','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003','meter','Lotus Home Meter',10,null,null,0,'active',origin,origin),
    ('30000000-0000-4000-8000-000000000103','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004','meter','Mango Home Meter',10,null,null,0,'active',origin,origin),
    ('30000000-0000-4000-8000-000000000104','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005','meter','Neem Home Meter',10,null,null,0,'active',origin,origin),
    ('30000000-0000-4000-8000-000000000105','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000006','meter','River Home Meter',10,null,null,0,'active',origin,origin)
  on conflict (id) do nothing;

  insert into public.data_connections(id,community_id,asset_id,connection_type,provider,status,created_at,updated_at)
  select private.seed_uuid('1','connection',id::text),'10000000-0000-4000-8000-000000000001',id,'simulator','solarshare-seed','active',origin,origin
  from (values
    ('30000000-0000-4000-8000-000000000001'::uuid),('30000000-0000-4000-8000-000000000101'::uuid),('30000000-0000-4000-8000-000000000102'::uuid),
    ('30000000-0000-4000-8000-000000000103'::uuid),('30000000-0000-4000-8000-000000000104'::uuid),('30000000-0000-4000-8000-000000000105'::uuid)
  ) as assets(id) on conflict (id) do nothing;

  insert into public.tariff_configs(id,community_id,feed_in_rate,retail_rate,seller_margin_ratio,buyer_discount_ratio,effective_from,created_by,created_at)
  values('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',3.5,8,0.1,0.1,origin,'20000000-0000-4000-8000-000000000001',origin)
  on conflict (id) do nothing;

  update public.outbox_events set status='failed',last_error_code='demo_reset',claimed_at=null,claimed_by=null,claim_token=null,claim_expires_at=null
  where community_id='10000000-0000-4000-8000-000000000001' and scenario_generation_id is not null and status in ('pending','claimed');
  delete from public.settlement_inputs where community_id='10000000-0000-4000-8000-000000000001' and scenario_generation_id is not null;
  delete from public.ledger_entries where community_id='10000000-0000-4000-8000-000000000001' and scenario_generation_id is not null;
  delete from public.ledger_transactions where community_id='10000000-0000-4000-8000-000000000001' and scenario_generation_id is not null;
  delete from public.settlements where community_id='10000000-0000-4000-8000-000000000001' and scenario_generation_id is not null;
  delete from public.allocations where community_id='10000000-0000-4000-8000-000000000001' and scenario_generation_id is not null;
  delete from public.offers where community_id='10000000-0000-4000-8000-000000000001' and scenario_generation_id is not null;
  delete from public.reservations where community_id='10000000-0000-4000-8000-000000000001' and scenario_generation_id is not null;
  delete from public.pricing_snapshots where community_id='10000000-0000-4000-8000-000000000001' and scenario_generation_id is not null;
  delete from public.feeder_snapshots where community_id='10000000-0000-4000-8000-000000000001' and scenario_generation_id is not null;
  delete from public.forecasts where community_id='10000000-0000-4000-8000-000000000001' and scenario_generation_id is not null;
  delete from public.energy_readings where community_id='10000000-0000-4000-8000-000000000001' and scenario_generation_id is not null;
  delete from public.market_intervals where community_id='10000000-0000-4000-8000-000000000001' and scenario_generation_id is not null;

  perform private.seed_demo_scenario('10000000-0000-4000-8000-000000000001','2026-09-13',generation_id);
  insert into public.audit_events(id,community_id,actor_user_id,event_type,subject_type,subject_id,request_id,details,occurred_at)
  values(private.seed_uuid('1','audit','demo.reset'),'10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','demo.reset','community','10000000-0000-4000-8000-000000000001','seed:canonical',jsonb_build_object('generationId',generation_id,'anchorDate','2026-09-13','counts',jsonb_build_object('marketIntervals',97,'energyReadings',675,'forecasts',384)),'2026-09-12 18:31:00+00')
  on conflict (id) do nothing;

  -- Spec 0002 seed contract: assert every expected count, naming the table that
  -- disagrees. Core tables are community scoped; generated scenario rows are
  -- additionally pinned to this run's generation UUID.
  for expectation in
    select * from (values
      ('profiles','profiles',6),
      ('communities','communities',1),
      ('community_members','community',6),
      ('credit_accounts','community',6),
      ('energy_assets','community',6),
      ('data_connections','community',6),
      ('tariff_configs','community',1),
      ('audit_events','community',2),
      ('idempotency_records','community',1),
      ('market_intervals','generation',97),
      ('energy_readings','generation',675),
      ('forecasts','generation',384),
      ('feeder_snapshots','generation',98),
      ('pricing_snapshots','generation',1),
      ('offers','generation',2),
      ('reservations','generation',5),
      ('allocations','generation',1),
      ('settlements','generation',1),
      ('settlement_inputs','generation',3),
      ('ledger_transactions','generation',1),
      ('ledger_entries','generation',2),
      ('outbox_events','generation',1)
    ) as manifest(relation, scope, expected)
  loop
    execute
      case expectation.scope
        when 'profiles' then format('select count(*) from public.profiles where id = any(%L::uuid[])', demo_user_ids)
        when 'communities' then format('select count(*) from public.communities where id = %L', demo_community)
        when 'community' then format('select count(*) from public.%I where community_id = %L', expectation.relation, demo_community)
        else format('select count(*) from public.%I where community_id = %L and scenario_generation_id = %L', expectation.relation, demo_community, generation_id)
      end
    into actual;
    if actual <> expectation.expected then
      raise exception 'SolarShare seed count mismatch for %: expected %, found %', expectation.relation, expectation.expected, actual;
    end if;
  end loop;
end;
$$;

commit;
