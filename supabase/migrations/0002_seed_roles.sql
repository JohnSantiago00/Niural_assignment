insert into public.roles (
  title,
  team,
  location,
  remote_status,
  experience_level,
  responsibilities,
  requirements,
  status
)
values
  (
    'AI Product Operator',
    'Operations',
    'New York, NY',
    'Hybrid',
    'Mid-Level',
    array[
      'Own daily orchestration across internal hiring workflows and identify points where automation should replace manual work.',
      'Translate process ambiguity into deterministic operating playbooks that engineering and recruiting can trust.',
      'Measure funnel health, triage operational issues quickly, and keep stakeholders informed with concise updates.'
    ],
    array[
      '3+ years in product operations, recruiting operations, or a similar systems-heavy role.',
      'Strong written communication and comfort working directly with engineers on workflow design.',
      'Evidence of building scalable processes with a bias for practical execution.'
    ],
    'open'
  ),
  (
    'Founding Full-Stack Engineer',
    'Engineering',
    'San Francisco, CA',
    'Remote',
    'Senior',
    array[
      'Ship end-to-end features across frontend, backend, and data layers with a high degree of autonomy.',
      'Design simple, production-ready systems that can evolve without unnecessary platform complexity.',
      'Partner closely with product and operations to improve speed, observability, and reliability.'
    ],
    array[
      '5+ years building web applications in TypeScript and modern React frameworks.',
      'Experience with PostgreSQL-backed products and pragmatic API design.',
      'Comfort making architecture tradeoffs in ambiguous startup environments.'
    ],
    'open'
  ),
  (
    'Technical Recruiter',
    'Talent',
    'Austin, TX',
    'Onsite',
    'Mid-Level',
    array[
      'Run full-cycle recruiting for technical roles while maintaining a high-quality candidate experience.',
      'Collaborate with hiring managers to improve role calibration, outreach quality, and feedback speed.',
      'Use structured processes and lightweight automation to keep pipelines organized and responsive.'
    ],
    array[
      '2+ years recruiting technical talent in-house or at a recruiting agency.',
      'Strong candidate communication and stakeholder management skills.',
      'A systems mindset with interest in improving recruiting operations through better tooling.'
    ],
    'open'
  )
on conflict do nothing;
