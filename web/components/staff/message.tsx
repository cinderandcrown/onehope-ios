import type { ChurchStore, YoutubeVideo } from "@onehope/server";

import { clearFeatureAction, featureMessageAction } from "@/app/staff-actions";

function one(query: Record<string, string | string[] | undefined>, key: string) {
  const value = query[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export function MessageDesk({
  store,
  token,
  videos,
  query,
}: {
  store: ChurchStore;
  token: string;
  videos: YoutubeVideo[];
  query: Record<string, string | string[] | undefined>;
}) {
  const current = store.featuredMessage();
  const messages = videos.filter((video) => video.kind === "message").slice(0, 8);
  const notice = one(query, "saved")
    ? "Saved. Home and Watch will show this message."
    : one(query, "error")
      ? "That message could not be featured. Try the list again."
      : "";
  const role = store.me(token).role;
  const allowed = role === "pastor" || role === "master_admin" || role === "team_leader";
  return (
    <section>
      <h1>This Sunday message</h1>
      <p className="help">
        How do I put this Sunday message on Home? Tap Feature on the video, add a speaker or a Bible passage
        if you want, then save. People see it on Home and at the top of Watch. Facebook Live is not
        connected.
      </p>
      {notice ? <p className="notice">{notice}</p> : null}
      {current ? (
        <article className="panel">
          <h2>On Home now</h2>
          <p>{current.title}</p>
          <p className="muted">
            {current.speaker}
            {current.passage ? ` · ${current.passage}` : ""}
          </p>
          {allowed ? (
            <form action={clearFeatureAction}>
              <button className="button secondary" type="submit">
                Take off Home
              </button>
            </form>
          ) : null}
        </article>
      ) : (
        <p>No message is featured yet. Pick one below and it replaces the blank spot on Overview.</p>
      )}
      {!allowed ? <p>Featuring a message is for pastors and team leaders.</p> : null}
      {messages.length === 0 ? (
        <p>YouTube did not load just now. Wait a minute and open this page again. Nothing was changed.</p>
      ) : (
        messages.map((video) => (
          <article className="panel" key={video.id}>
            <h2>{video.title}</h2>
            <p className="muted">{video.published.slice(0, 10)}</p>
            {allowed ? (
              <form className="form" action={featureMessageAction}>
                <input type="hidden" name="videoId" value={video.id} />
                <input type="hidden" name="link" value={video.link} />
                <input type="hidden" name="thumbnail" value={video.thumbnail ?? ""} />
                <label>
                  Title on Home
                  <input name="title" required maxLength={140} defaultValue={video.title} />
                </label>
                <label>
                  Speaker (optional)
                  <input name="speaker" maxLength={80} placeholder="One Hope" />
                </label>
                <label>
                  Passage (optional)
                  <input name="passage" maxLength={80} placeholder="John 3:16" />
                </label>
                <button className="button" type="submit">
                  Feature on Home
                </button>
              </form>
            ) : null}
          </article>
        ))
      )}
    </section>
  );
}
