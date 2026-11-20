import { parseYoutubeRss, type YoutubeVideo } from "./domain";

export async function loadSermons(fetchImpl: typeof fetch, channelId: string): Promise<YoutubeVideo[]> {
  if (!channelId) return [];
  try {
    const response = await fetchImpl(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
    );
    if (!response.ok) return [];
    return parseYoutubeRss(await response.text());
  } catch {
    return [];
  }
}

export function facebookLive(input: { pageId: string; token: string }) {
  void input;
  return {
    mode: "not_built" as const,
    message: "No Facebook Graph call is implemented. A Page token is not used.",
  };
}
