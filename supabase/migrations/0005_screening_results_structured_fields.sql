create or replace function public.text_array_to_education_jsonb(input text[])
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'institution', item,
        'degree', null,
        'field', null,
        'year', null
      )
    ),
    '[]'::jsonb
  )
  from unnest(input) as item;
$$;

create or replace function public.text_array_to_education_jsonb(input jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(input, '[]'::jsonb);
$$;

create or replace function public.text_array_to_employers_jsonb(input text[])
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'company', item,
        'title', null,
        'duration', null
      )
    ),
    '[]'::jsonb
  )
  from unnest(input) as item;
$$;

create or replace function public.text_array_to_employers_jsonb(input jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(input, '[]'::jsonb);
$$;

alter table public.screening_results
alter column education drop default;

alter table public.screening_results
alter column past_employers drop default;

alter table public.screening_results
alter column education type jsonb
using public.text_array_to_education_jsonb(education);

alter table public.screening_results
alter column past_employers type jsonb
using public.text_array_to_employers_jsonb(past_employers);

alter table public.screening_results
alter column education set default '[]'::jsonb;

alter table public.screening_results
alter column past_employers set default '[]'::jsonb;
