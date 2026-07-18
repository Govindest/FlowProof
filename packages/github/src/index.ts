import type { IssueDraft } from "@flowproof/core";

export async function createGitHubIssue(
  draft: IssueDraft,
  token = process.env.GITHUB_TOKEN,
  repository = process.env.GITHUB_REPOSITORY,
): Promise<{ url: string } | null> {
  if (!token || !repository) return null;
  const response = await fetch(
    `https://api.github.com/repos/${repository}/issues`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
      },
      body: JSON.stringify({
        title: draft.title,
        body: draft.body,
        labels: draft.labels,
      }),
    },
  );
  if (!response.ok)
    throw new Error(`GitHub issue creation failed: ${response.status}`);
  const payload = (await response.json()) as { html_url: string };
  return { url: payload.html_url };
}
