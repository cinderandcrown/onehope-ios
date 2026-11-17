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
  if (!input.pageId || !input.token) {
    return {
      mode: "placeholder" as const,
      message: "Facebook Live stays empty until a Page token is set on the server.",
    };
  }
  return {
    mode: "ready" as const,
    message: "A Page token is set on the server. The app never receives it.",
    pageId: input.pageId,
  };
}
