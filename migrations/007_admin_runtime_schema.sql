-- Bring the admin CMS tables in line with the current API contracts.
-- Apply after 006_admin_redesign.sql. Existing content is retained and backfilled.

-- Blog editor fields used by Admin.blog.routes.ts.
alter table public.blog_posts
  add column if not exists content text not null default '',
  add column if not exists cover_image_url text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists author_name text,
  add column if not exists seo_description text,
  add column if not exists featured boolean not null default false,
  add column if not exists published boolean not null default false;

update public.blog_posts
set content = coalesce(nullif(content, ''), body, ''),
    author_name = coalesce(author_name, author),
    published = (status = 'published' or published),
    featured = coalesce(featured, false),
    tags = coalesce(tags, '{}');

create index if not exists blog_posts_published_updated_idx
  on public.blog_posts (published, updated_at desc);

-- The settings API uses one structured row. Keep the legacy key/value columns
-- from 006 for backwards compatibility while adding the fields it edits.
alter table public.site_settings
  add column if not exists singleton boolean,
  add column if not exists site_name text,
  add column if not exists tagline text,
  add column if not exists contact_email text,
  add column if not exists phone text,
  add column if not exists location text,
  add column if not exists linkedin_url text,
  add column if not exists github_url text,
  add column if not exists x_url text,
  add column if not exists default_meta_title text,
  add column if not exists default_meta_description text;

-- Some installations already have the direct-column settings schema and do
-- not have the legacy JSON `value` column. Only read it when it is present.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'site_settings' and column_name = 'value'
  ) then
    execute $sql$
      update public.site_settings
      set site_name = coalesce(nullif(site_name, ''), value ->> 'site_name', 'SiliconBrains'),
          tagline = coalesce(tagline, value ->> 'tagline'),
          contact_email = coalesce(contact_email, value ->> 'contact_email'),
          phone = coalesce(phone, value ->> 'phone'),
          location = coalesce(location, value ->> 'location'),
          linkedin_url = coalesce(linkedin_url, value ->> 'linkedin_url'),
          github_url = coalesce(github_url, value ->> 'github_url'),
          x_url = coalesce(x_url, value ->> 'x_url'),
          default_meta_title = coalesce(default_meta_title, value ->> 'default_meta_title'),
          default_meta_description = coalesce(default_meta_description, value ->> 'default_meta_description'),
          singleton = coalesce(singleton, false),
          updated_at = coalesce(updated_at, now())
    $sql$;
  else
    update public.site_settings
    set site_name = coalesce(nullif(site_name, ''), 'SiliconBrains'),
        singleton = coalesce(singleton, false),
        updated_at = coalesce(updated_at, now());
  end if;
end
$$;

-- Preserve one existing settings row as the singleton if one exists.
with selected as (
  select id
  from public.site_settings
  order by updated_at desc nulls last, id
  limit 1
)
update public.site_settings
set singleton = true
where id = (select id from selected)
  and not exists (select 1 from public.site_settings where singleton = true);

alter table public.site_settings
  alter column singleton set default true,
  alter column singleton set not null,
  alter column site_name set default 'SiliconBrains',
  alter column site_name set not null,
  alter column updated_at set default now();

create unique index if not exists site_settings_singleton_idx
  on public.site_settings (singleton) where singleton = true;

-- 006 defines key/value as required, but some installations already use only
-- direct columns. Seed the singleton using whichever schema is present.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'site_settings' and column_name = 'key'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'site_settings' and column_name = 'value'
    ) then
      execute $sql$
        insert into public.site_settings (key, value, singleton, site_name)
        select 'global', '{}'::jsonb, true, 'SiliconBrains'
        where not exists (select 1 from public.site_settings where singleton = true)
        on conflict (key) do update set singleton = true
      $sql$;
    else
      execute $sql$
        insert into public.site_settings (key, singleton, site_name)
        select 'global', true, 'SiliconBrains'
        where not exists (select 1 from public.site_settings where singleton = true)
      $sql$;
    end if;
  else
    insert into public.site_settings (singleton, site_name)
    select true, 'SiliconBrains'
    where not exists (select 1 from public.site_settings where singleton = true);
  end if;
end
$$;

notify pgrst, 'reload schema';
