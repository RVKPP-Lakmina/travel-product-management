-- ============================================================================
-- Local development seed data.
-- Run automatically by `supabase db reset` (see supabase/config.toml,
-- [db.seed] sql_paths). NOT part of the migration history — this is demo
-- data for local development and for a reviewer's first `docker compose up`,
-- not schema. Categories (reference data) are seeded in the 0001 migration
-- instead, since every environment — including a future production one —
-- needs them.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- One demo user so seeded products have a valid created_by and there is an
-- account to sign in with locally. Local-only credentials, never used
-- outside `supabase start`.
-- ---------------------------------------------------------------------------
do $$
declare
  demo_user_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  if not exists (select 1 from auth.users where id = demo_user_id) then
    -- GoTrue's Go struct scans several of these text columns as non-
    -- nullable — leaving them at their column default (NULL) causes
    -- "converting NULL to string is unsupported" on the next login. They
    -- must be explicit empty strings, not NULL.
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin,
      confirmation_token, recovery_token,
      email_change, email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      demo_user_id,
      'authenticated',
      'authenticated',
      'demo@travel.local',
      crypt('DemoPassword123!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      false,
      '', '', '', '', '', '', '', ''
    );

    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      demo_user_id::text,
      demo_user_id,
      jsonb_build_object('sub', demo_user_id::text, 'email', 'demo@travel.local'),
      'email',
      now(), now(), now()
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Products. Dates are relative to CURRENT_DATE so the seed stays meaningful
-- on whatever day `supabase db reset` runs. Several are deliberately in the
-- past (valid_until < today) so the validity rule and the dashboard's
-- Expired tile are demonstrable on a fresh clone without waiting for
-- anything to actually expire.
-- ---------------------------------------------------------------------------
insert into public.products
  (name, destination, category, description, price, inventory_count,
   valid_from, valid_until, status, highlights, inclusions, tags, created_by)
values
  -- ── Active, comfortably within their window ────────────────────────────
  ('Cinnamon Grand Seafood Dinner Buffet', 'Colombo', 'dining',
   'An indulgent evening seafood buffet at Cinnamon Grand Colombo featuring fresh Ceylon lagoon crab, prawns, and a live seafood grill station overlooking the city skyline.',
   9450.00, 25, current_date - 10, current_date + 25, 'active',
   array['Live seafood grill station', 'Free-flow soft beverages', 'Ceylon lagoon crab'],
   array['Buffet dinner', 'Welcome drink', 'Service charge'],
   array['buffet', 'seafood', 'colombo', 'dinner'],
   '00000000-0000-0000-0000-000000000001'),

  ('Galle Face Sunset Dinner Buffet', 'Colombo', 'dining',
   'A relaxed dinner buffet with ocean views along Galle Face Green, featuring Sri Lankan and international cuisine stations.',
   6200.00, 40, current_date - 5, current_date + 45, 'active',
   array['Ocean-facing seating', 'Live cooking stations'],
   array['Buffet dinner', 'Live music'],
   array['buffet', 'dinner', 'colombo', 'ocean-view'],
   '00000000-0000-0000-0000-000000000001'),

  ('Sigiriya Rock Fortress Dawn Private Tour', 'Sigiriya', 'excursion',
   'A private guided climb of Sigiriya Rock Fortress at dawn, beating the heat and the crowds, with a licensed archaeological guide.',
   24800.00, 16, current_date - 2, current_date + 90, 'active',
   array['Private licensed guide', 'Dawn departure', 'Skip-the-queue tickets'],
   array['Entrance tickets', 'Guide fees', 'Bottled water'],
   array['sigiriya', 'fortress', 'tour', 'cultural triangle'],
   '00000000-0000-0000-0000-000000000001'),

  ('Yala National Park VIP Leopard Safari', 'Yala', 'safari',
   'A full-day 4x4 safari through Yala Block 1 with an experienced tracker, focused on leopard, elephant, and sloth bear sightings.',
   48500.00, 8, current_date - 1, current_date + 120, 'active',
   array['4x4 jeep with tracker', 'Leopard-dense Block 1 route', 'Packed breakfast'],
   array['Park entrance fees', 'Jeep hire', 'Tracker fees'],
   array['safari', 'yala', 'wildlife', 'leopard'],
   '00000000-0000-0000-0000-000000000001'),

  ('Kandy Cultural Triangle Family Package', 'Kandy', 'family',
   'A two-day family package covering the Temple of the Tooth, Kandy Lake, and the Royal Botanical Gardens, with a kid-friendly pace and a private driver throughout.',
   38000.00, 12, current_date - 3, current_date + 60, 'active',
   array['Private driver both days', 'Kid-friendly itinerary pace', 'Botanical Gardens entry'],
   array['Accommodation (1 night)', 'Breakfast', 'All entrance fees'],
   array['family', 'kandy', 'cultural', 'package'],
   '00000000-0000-0000-0000-000000000001'),

  ('Bandaranaike Airport Private Transfer', 'Colombo', 'transport',
   'A private air-conditioned vehicle transfer between Bandaranaike International Airport and Colombo city hotels, available around the clock.',
   4500.00, 60, current_date - 20, current_date + 200, 'active',
   array['Meet & greet at arrivals', '24/7 availability', 'Flight tracking'],
   array['Private vehicle', 'Driver', 'Fuel & tolls'],
   array['airport', 'transfer', 'transport', 'colombo'],
   '00000000-0000-0000-0000-000000000001'),

  ('Ella to Kandy Scenic Train Transfer', 'Ella', 'transport',
   'A reserved first-class seat on the scenic Ella-to-Kandy railway, one of the most photographed train journeys in the world.',
   3200.00, 30, current_date - 1, current_date + 30, 'active',
   array['Reserved first-class seat', 'Nine Arches Bridge views'],
   array['Train ticket'],
   array['train', 'ella', 'kandy', 'scenic', 'transfer'],
   '00000000-0000-0000-0000-000000000001'),

  ('Heritance Tea Factory Heritage Suite', 'Nuwara Eliya', 'accommodation',
   'A night in a converted colonial-era tea factory turned boutique hotel, surrounded by working tea plantations in the hill country.',
   78200.00, 6, current_date - 7, current_date + 75, 'active',
   array['Converted tea factory building', 'Panoramic plantation views', 'In-house tea museum'],
   array['1 night stay', 'Breakfast', 'Tea factory tour'],
   array['hotel', 'nuwara eliya', 'tea', 'heritage', 'accommodation'],
   '00000000-0000-0000-0000-000000000001'),

  ('Galle Fort Living History Walking Tour', 'Galle', 'excursion',
   'A guided walking tour through the UNESCO-listed Galle Fort, covering Dutch colonial architecture, ramparts, and the old lighthouse.',
   8900.00, 20, current_date - 4, current_date + 150, 'active',
   array['UNESCO World Heritage site', 'Licensed local guide', 'Rampart sunset viewpoint'],
   array['Guide fees'],
   array['galle', 'fort', 'walking tour', 'cultural', 'history'],
   '00000000-0000-0000-0000-000000000001'),

  ('Bentota River Safari & Mangrove Tour', 'Bentota', 'excursion',
   'A boat safari along the Bentota River and its mangrove estuary, spotting water monitors, kingfishers, and fruit bats.',
   5400.00, 24, current_date, current_date + 60, 'active',
   array['Mangrove estuary route', 'Small-group boat'],
   array['Boat ride', 'Life jackets'],
   array['bentota', 'river', 'boat', 'nature', 'excursion'],
   '00000000-0000-0000-0000-000000000001'),

  ('Colombo Ayurveda Wellness Retreat Day', 'Colombo', 'wellness',
   'A full day of traditional Ayurvedic treatments, herbal steam, and a guided meditation session at a certified Colombo wellness centre.',
   15600.00, 10, current_date - 6, current_date + 40, 'active',
   array['Certified Ayurvedic practitioners', 'Herbal steam bath', 'Guided meditation'],
   array['Consultation', 'Treatments', 'Herbal lunch'],
   array['spa', 'ayurveda', 'wellness', 'colombo'],
   '00000000-0000-0000-0000-000000000001'),

  ('Pinnawala Elephant Orphanage Family Day', 'Kegalle', 'family',
   'A family-friendly day trip to the Pinnawala Elephant Orphanage, including the riverside bathing session and a nearby lunch stop.',
   6800.00, 30, current_date - 8, current_date + 90, 'active',
   array['Elephant river-bathing session', 'Family-paced schedule'],
   array['Entrance tickets', 'Transport', 'Lunch'],
   array['family', 'elephant', 'pinnawala', 'kids'],
   '00000000-0000-0000-0000-000000000001'),

  ('Nine Arches Bridge Sunrise Hike', 'Ella', 'adventure',
   'An early-morning guided hike to Nine Arches Bridge and Little Adam''s Peak, timed for sunrise over the tea hills.',
   4200.00, 18, current_date - 1, current_date + 55, 'active',
   array['Sunrise timing', 'Little Adam''s Peak add-on'],
   array['Guide'],
   array['ella', 'hike', 'adventure', 'sunrise'],
   '00000000-0000-0000-0000-000000000001'),

  ('Colombo Pettah Market Shopping Tour', 'Colombo', 'shopping',
   'A guided walk through Pettah''s bustling street markets, spice stalls, and textile bazaars with a local shopping expert.',
   3500.00, 25, current_date, current_date + 30, 'active',
   array['Local shopping expert', 'Spice market visit'],
   array['Guide'],
   array['shopping', 'pettah', 'market', 'colombo'],
   '00000000-0000-0000-0000-000000000001'),

  ('Kandy Esala Perahera Cultural Evening', 'Kandy', 'cultural',
   'An evening cultural dance performance and fire-walking show near the Temple of the Tooth, a taste of the Esala Perahera tradition.',
   5200.00, 50, current_date - 3, current_date + 35, 'active',
   array['Traditional Kandyan dance', 'Fire-walking finale'],
   array['Show tickets'],
   array['kandy', 'cultural', 'dance', 'perahera'],
   '00000000-0000-0000-0000-000000000001'),

  -- ── Inactive but NOT expired (tests orthogonality of status vs expiry) ──
  ('Trincomalee Whale Watching Charter', 'Trincomalee', 'excursion',
   'A half-day boat charter off Trincomalee for blue whale and sperm whale watching during the seasonal window.',
   19500.00, 12, current_date - 10, current_date + 100, 'inactive',
   array['Blue whale season route', 'Small-group charter'],
   array['Boat charter', 'Life jackets', 'Snacks'],
   array['whale watching', 'trincomalee', 'boat'],
   '00000000-0000-0000-0000-000000000001'),

  ('Negombo Lagoon Sunset Cruise', 'Negombo', 'excursion',
   'A relaxed catamaran cruise on Negombo Lagoon at sunset, with light refreshments served on board.',
   7200.00, 20, current_date - 15, current_date + 45, 'inactive',
   array['Sunset timing', 'On-board refreshments'],
   array['Cruise', 'Refreshments'],
   array['negombo', 'lagoon', 'cruise', 'sunset'],
   '00000000-0000-0000-0000-000000000001'),

  -- ── Deliberately EXPIRED — proves the validity rule + Expired tile ─────
  ('Cinnamon Lakeside New Year Eve Gala Buffet', 'Colombo', 'dining',
   'A New Year''s Eve gala dinner buffet with live entertainment and a midnight countdown, held at Cinnamon Lakeside Colombo.',
   18500.00, 0, current_date - 100, current_date - 1, 'active',
   array['Live band', 'Midnight countdown', 'Fireworks view'],
   array['Gala buffet dinner', 'Welcome cocktail'],
   array['gala', 'new year', 'colombo', 'buffet'],
   '00000000-0000-0000-0000-000000000001'),

  ('Vesak Festival Colombo Lantern Walking Tour', 'Colombo', 'cultural',
   'A guided evening walk through Colombo''s Vesak lantern displays and pandals, held only during the Vesak festival period.',
   3800.00, 0, current_date - 130, current_date - 90, 'active',
   array['Seasonal lantern displays', 'Local guide'],
   array['Guide fees'],
   array['vesak', 'festival', 'colombo', 'cultural'],
   '00000000-0000-0000-0000-000000000001'),

  ('Kataragama Festival Pilgrimage Package', 'Kataragama', 'cultural',
   'A pilgrimage package to the Kataragama festival, including transport and a local guide familiar with the annual ceremonies.',
   12400.00, 0, current_date - 200, current_date - 160, 'inactive',
   array['Festival-period only', 'Local pilgrimage guide'],
   array['Transport', 'Guide'],
   array['kataragama', 'festival', 'pilgrimage', 'cultural'],
   '00000000-0000-0000-0000-000000000001'),

  ('Galle Literary Festival Weekend Pass', 'Galle', 'cultural',
   'A weekend pass to the (now-concluded) Galle Literary Festival, including access to author talks and workshops within the Fort.',
   22000.00, 0, current_date - 60, current_date - 30, 'active',
   array['All-sessions access', 'Author meet & greets'],
   array['Festival pass'],
   array['galle', 'literary festival', 'cultural'],
   '00000000-0000-0000-0000-000000000001');
