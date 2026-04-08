/**
 * Lightweight source retrieval for candidate enrichment. The app uses
 * candidate-submitted URLs first and fetches plain page content conservatively,
 * avoiding brittle scraping flows or unverified third-party profile claims.
 */
type EnrichmentSourceKind = "linkedin" | "github" | "portfolio" | "x";
export type EnrichmentSourceStatus =
  | "missing"
  | "fetched_direct"
  | "blocked"
  | "unavailable";

export type EnrichmentSourceContent = {
  kind: EnrichmentSourceKind;
  url: string | null;
  status: EnrichmentSourceStatus;
  content: string | null;
  title: string | null;
  description: string | null;
  note: string | null;
};

function cleanWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripHtml(html: string) {
  return cleanWhitespace(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

function getMetaContent(html: string, name: string) {
  const metaRegex = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const match = html.match(metaRegex);
  return match?.[1]?.trim() ?? null;
}

function getTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? cleanWhitespace(match[1]) : null;
}

function isLinkedInUrl(url: string) {
  try {
    return new URL(url).hostname.includes("linkedin.com");
  } catch {
    return false;
  }
}

function isLinkedInBlockedStatus(status: number) {
  return status === 999 || status === 403 || status === 401;
}

async function fetchSource(
  kind: EnrichmentSourceKind,
  url: string | null,
  _candidateName: string | null
): Promise<EnrichmentSourceContent> {
  if (!url) {
    return {
      kind,
      url: null,
      status: "missing",
      content: null,
      title: null,
      description: null,
      note: `${kind} URL was not provided by the candidate.`
    };
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Niural-Hiring-Enrichment/1.0"
      },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store"
    });

    if (!response.ok) {
      if (kind === "linkedin" && isLinkedInUrl(url) && isLinkedInBlockedStatus(response.status)) {
        return {
          kind,
          url,
          status: "blocked",
          content: null,
          title: null,
          description: null,
          note:
            "LinkedIn blocked automated access. The submitted LinkedIn URL is still available for manual review."
        };
      }

      return {
        kind,
        url,
        status: "unavailable",
        content: null,
        title: null,
        description: null,
        note: `${kind} page returned HTTP ${response.status}.`
      };
    }

    const html = await response.text();
    const title = getTitle(html);
    const description = getMetaContent(html, "description") ?? getMetaContent(html, "og:description");
    const text = stripHtml(html).slice(0, 12_000);

    if (!text) {
      return {
        kind,
        url,
        status: "unavailable",
        content: null,
        title,
        description,
        note: `${kind} page did not expose readable text content.`
      };
    }

    return {
      kind,
      url,
      status: "fetched_direct",
      content: text,
      title,
      description,
      note: null
    };
  } catch (error) {
    if (kind === "linkedin" && isLinkedInUrl(url)) {
      return {
        kind,
        url,
        status: "blocked",
        content: null,
        title: null,
        description: null,
        note:
          "LinkedIn blocked automated access or limited public retrieval. The submitted LinkedIn URL is still available for manual review."
      };
    }

    return {
      kind,
      url,
      status: "unavailable",
      content: null,
      title: null,
      description: null,
      note: error instanceof Error ? error.message : `Failed to fetch ${kind} source.`
    };
  }
}

export async function fetchEnrichmentSources(input: {
  candidateName: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  xUrl?: string | null;
}) {
  const [linkedin, github, portfolio, x] = await Promise.all([
    fetchSource("linkedin", input.linkedinUrl, input.candidateName),
    fetchSource("github", input.githubUrl, input.candidateName),
    fetchSource("portfolio", input.portfolioUrl, input.candidateName),
    fetchSource("x", input.xUrl ?? null, input.candidateName)
  ]);

  return { linkedin, github, portfolio, x };
}
