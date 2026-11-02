-- VV inc. fleet app: database schema.
-- Security model: Row Level Security is ON for every table with NO policies, so the public
-- (anon) key can read/write nothing. Only the server's Edge Functions (service role / direct
-- DB connection) touch the data. The phone app and the guest check-in page talk to Edge Functions.

-- ---------- people ----------
create table staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null check (role in ('executive', 'employee')),
  pin_hash text not null,
  pin_salt text not null,
  assigned_car_ids text[] not null default '{}',
  home_page text,
  created_at timestamptz not null default now()
);

-- Sign-in sessions for the app (PIN → session token). Only a hash of the token is stored.
create table sessions (
  token_hash text primary key,
  staff_id uuid not null references staff (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- One row: wrong-PIN lockout state for the whole app.
create table pin_lockout (
  id int primary key default 1 check (id = 1),
  failed_attempts int not null default 0,
  locked_until timestamptz,
  lockouts int not null default 0
);

-- ---------- cars ----------
create table cars (
  id text primary key,
  year int,
  make text not null,
  model text not null,
  color text,
  plate text,
  smartcar_vehicle_id text,
  zubie_device_id text
);

-- Latest known state per car: location from Zubie, lock state from Smartcar.
create table telemetry (
  car_id text primary key references cars (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  engine_on boolean not null default false,
  moving boolean not null default false,
  parked_since timestamptz,
  lock_state text not null default 'unknown' check (lock_state in ('locked', 'unlocked', 'unknown')),
  last_unlocked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table trips (
  id text primary key,
  car_id text not null references cars (id) on delete cascade,
  departed_at timestamptz not null,
  arrived_at timestamptz,
  distance_mi numeric not null default 0,
  from_label text not null default '',
  to_label text not null default '',
  stops int not null default 0
);
create index trips_car_departed on trips (car_id, departed_at desc);

-- ---------- bookings (from Turo emails) ----------
create table bookings (
  id text primary key, -- Turo reservation ID
  car_id text references cars (id),
  guest_first_name text not null,
  guest_phone text,
  trip_start timestamptz not null,
  trip_end timestamptz not null,
  earnings numeric not null default 0,
  canceled boolean not null default false,
  cancel_reason text,
  check_in_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  turo_conversation_url text,
  link_sent_at timestamptz,
  check_in_state text not null default 'waiting' check (check_in_state in ('waiting', 'unlocked', 'relocked', 'started', 'expired')),
  unlock_count int not null default 0,
  last_unlock_at timestamptz,
  updated_at timestamptz not null default now()
);
create index bookings_trip_start on bookings (trip_start);

-- ---------- money ----------
create table earning_extras (
  id text primary key,
  type text not null check (type in ('trip', 'incentive', 'reimbursement', 'missed')),
  amount numeric not null,
  date timestamptz not null,
  car_id text references cars (id),
  reservation_id text,
  description text not null default '',
  source text not null default 'turo_email',
  status text -- e.g. 'invoiced', 'paid' for reimbursements
);

create table payouts (
  id text primary key,
  sent_at timestamptz not null,
  amount numeric not null,
  method text not null default 'Bank transfer',
  source text not null default 'turo_email'
);

-- ---------- tasks ----------
create table tasks_extra (
  id text primary key,
  kind text not null,
  title text not null,
  detail text,
  booking_id text,
  car_id text references cars (id),
  due_at timestamptz not null,
  source text not null default 'turo_email'
);

create table task_done (
  task_id text primary key,
  done_at timestamptz not null default now(),
  done_by text not null
);

create table task_alerts_sent (key text primary key, sent_at timestamptz not null default now());
create table late_alerts_sent (booking_id text primary key, sent_at timestamptz not null default now());

-- ---------- hours & activity ----------
create table shifts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff (id) on delete cascade,
  clock_in timestamptz not null,
  clock_out timestamptz
);

create table activity (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  action text not null,
  actor jsonb not null, -- {kind:'user',userId,name} | {kind:'guest',bookingId,name} | {kind:'system'}
  car_id text,
  detail text,
  notify boolean not null default false
);
create index activity_at on activity (at desc);

-- ---------- settings ----------
create table settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null
);

-- ---------- email intake log (each Turo email is applied once) ----------
create table emails (
  message_id text primary key,
  received_at timestamptz not null,
  subject text not null,
  kind text not null,
  parsed jsonb,
  error text,
  processed_at timestamptz not null default now()
);

-- ---------- lock everything down ----------
do $$
declare t text;
begin
  foreach t in array array['staff','sessions','pin_lockout','cars','telemetry','trips','bookings','earning_extras','payouts',
                           'tasks_extra','task_done','task_alerts_sent','late_alerts_sent','shifts','activity','settings','emails']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
