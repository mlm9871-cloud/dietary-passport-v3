-- Supabase schema for Dining Passport
-- Tables: organizations, users, dietary_profiles, restrictions, dietary_profile_restrictions, qr_tokens

create extension if not exists "uuid-ossp";

-- Organizations
create table if not exists organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz default now()
);

-- Users (application-level users, auth mapping can be added to link to auth.users)
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  full_name text,
  organization_id uuid references organizations(id) on delete set null,
  created_at timestamptz default now()
);

-- Dietary profiles belong to a user (a student may have multiple profiles)
create table if not exists dietary_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  display_name text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Restrictions (canonical restriction types)
create table if not exists restrictions (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  severity text check (severity in ('low','medium','high')),
  created_at timestamptz default now()
);

-- Join table: a dietary profile can have many restrictions
create table if not exists dietary_profile_restrictions (
  id uuid primary key default uuid_generate_v4(),
  dietary_profile_id uuid not null references dietary_profiles(id) on delete cascade,
  restriction_id uuid not null references restrictions(id) on delete cascade,
  notes text,
  created_at timestamptz default now(),
  unique (dietary_profile_id, restriction_id)
);

-- QR tokens for sharing or quick lookup of a dietary profile
create table if not exists qr_tokens (
  id uuid primary key default uuid_generate_v4(),
  dietary_profile_id uuid not null references dietary_profiles(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz,
  created_at timestamptz default now()
);
