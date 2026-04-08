create or replace function public.discrepancy_text_array_to_jsonb(input text[])
returns jsonb
language sql
immutable
as $$
  select coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'type', 'missing_supporting_evidence',
          'severity', 'low',
          'description', item,
          'source', null
        )
      )
      from unnest(coalesce(input, '{}')) as item
    ),
    '[]'::jsonb
  );
$$;

create or replace function public.discrepancy_text_array_to_jsonb(input jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(input, '[]'::jsonb);
$$;

alter table public.research_profiles
add column if not exists discrepancy_flags_v2 jsonb not null default '[]'::jsonb;

update public.research_profiles
set discrepancy_flags_v2 = public.discrepancy_text_array_to_jsonb(discrepancy_flags);

alter table public.research_profiles
drop column discrepancy_flags;

alter table public.research_profiles
rename column discrepancy_flags_v2 to discrepancy_flags;

alter table public.research_profiles
add column if not exists confidence_score integer not null default 0
check (confidence_score >= 0 and confidence_score <= 100);
