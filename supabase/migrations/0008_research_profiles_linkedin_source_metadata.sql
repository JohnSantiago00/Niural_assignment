alter table public.research_profiles
add column if not exists linkedin_source_status text not null default 'missing'
check (
  linkedin_source_status in (
    'missing',
    'fetched_direct',
    'blocked',
    'unavailable'
  )
);

alter table public.research_profiles
add column if not exists linkedin_source_note text;

update public.research_profiles
set
  linkedin_source_status = case
    when linkedin_url_used is null then 'missing'
    when linkedin_summary is not null then 'fetched_direct'
    else 'unavailable'
  end,
  linkedin_source_note = case
    when linkedin_url_used is null then 'LinkedIn profile was not provided.'
    when linkedin_summary is not null then 'LinkedIn enrichment used readable public profile content.'
    else 'Automated LinkedIn enrichment could not gather enough public evidence. The submitted LinkedIn URL is still available for manual review.'
  end;
