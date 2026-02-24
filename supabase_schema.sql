-- Create a table to store encrypted user data
create table if not exists public.user_data (
  user_id uuid references auth.users not null primary key,
  iv text not null,
  ciphertext text not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.user_data enable row level security;

-- Create policies
create policy "Users can view their own data" on public.user_data
  for select using (auth.uid() = user_id);

create policy "Users can insert their own data" on public.user_data
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own data" on public.user_data
  for update using (auth.uid() = user_id);

-- Optional: Allow users to delete their own data
create policy "Users can delete their own data" on public.user_data
  for delete using (auth.uid() = user_id);
