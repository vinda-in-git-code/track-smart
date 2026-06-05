
-- profiles table to store user information like email, full name, avatar URL, and admin status
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  is_admin boolean default false,
  created_at timestamptz default now()
);


-- transactions table to store income and expense records with fields for amount, category, note, date, and payment method
create table transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  type text check (type in ('income', 'expense')) not null,
  amount numeric not null,
  category text not null,
  note text,
  date date not null,
  created_at timestamptz default now()
);

alter table transactions
add column if not exists payment_method text default 'Cash';


-- budgets table to store monthly budget limits for different categories, linked to users
create table budgets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  category text not null,
  amount numeric not null,
  month text not null,
  created_at timestamptz default now()
);


-- goals table to store user-defined financial goals with target amounts, current progress, deadlines, and optional emojis for visualization
create table goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  target_amount numeric not null,
  current_amount numeric default 0,
  deadline date,
  emoji text default '🎯',
  created_at timestamptz default now()
);


-- split_bills table to manage shared expenses, with fields for title, filename (for receipt), total amount, items, people involved, assignments, and totals per person
create table split_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text default 'Split Bill',
  filename text,
  total_belanja bigint default 0,
  items jsonb default '[]',
  people jsonb default '[]',
  assignments jsonb default '{}',
  person_totals jsonb default '{}',
  created_at timestamptz default now()
);

alter table split_bills
add column if not exists category text default 'Other';


-- user_roles table to manage user roles (admin or user) for access control
create table user_roles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  role text check (role in ('admin', 'user')) default 'user',
  created_at timestamptz default now(),
  unique(user_id)
);


-- enable row level security on all tables to ensure that users can only access their own data
alter table profiles enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table goals enable row level security;
alter table split_bills enable row level security;
alter table app_settings enable row level security;
alter table user_roles enable row level security;


-- profiles policies to allow users to only view and manage their own profile information, ensuring privacy and security of user data
create policy "profiles_select"
on profiles for select
using (auth.uid() = id);

create policy "profiles_insert"
on profiles for insert
with check (auth.uid() = id);

create policy "profiles_update"
on profiles for update
using (auth.uid() = id);


-- transactions policies to allow users to only view and manage their own transactions, ensuring that financial data is secure and private to each user
create policy "Users can view own transactions"
on transactions for select
using (auth.uid() = user_id);

create policy "Users can insert own transactions"
on transactions for insert
with check (auth.uid() = user_id);

create policy "Users can update own transactions"
on transactions for update
using (auth.uid() = user_id);

create policy "Users can delete own transactions"
on transactions for delete
using (auth.uid() = user_id);


-- budgets policies to allow users to only view and manage their own budgets, ensuring that budget information is secure and private to each user
create policy "Users can view own budgets"
on budgets for select
using (auth.uid() = user_id);

create policy "Users can insert own budgets"
on budgets for insert
with check (auth.uid() = user_id);

create policy "Users can update own budgets"
on budgets for update
using (auth.uid() = user_id);

create policy "Users can delete own budgets"
on budgets for delete
using (auth.uid() = user_id);


-- goals policies to allow users to only view and manage their own financial goals, ensuring that goal information is secure and private to each user
create policy "Users can view own goals"
on goals for select
using (auth.uid() = user_id);

create policy "Users can insert own goals"
on goals for insert
with check (auth.uid() = user_id);

create policy "Users can update own goals"
on goals for update
using (auth.uid() = user_id);

create policy "Users can delete own goals"
on goals for delete
using (auth.uid() = user_id);


-- split_bills policies to allow users to only view and manage their own split bills, ensuring that shared expense information is secure and private to each user
create policy "Users manage own split bills"
on split_bills
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


-- app_settings policies to allow anyone to read application settings, which may include non-sensitive configuration data that can be accessed by all users
create policy "Anyone can read app_settings"
on app_settings
for select
using (true);


-- user_roles policies to allow users to only view their own role information, ensuring that role data is secure and private to each user
create policy "Anyone can view own role"
on user_roles
for select
using (auth.uid() = user_id);


-- trigger function to automatically create a profile for new users when they sign up, ensuring that each user has a corresponding profile record in the database
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();


-- create a storage bucket for user avatars, allowing users to upload and manage their profile pictures in a dedicated storage location
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatar_upload"
on storage.objects
for insert
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "avatar_update"
on storage.objects
for update
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "avatar_read"
on storage.objects
for select
using (bucket_id = 'avatars');
```
