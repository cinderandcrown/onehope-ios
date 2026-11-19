import { UNIVERSAL_LINK_PATHS } from "@onehope/server";

export const dynamic = "force-static";

/** Lets the iPhone open invite, visit, coffee, and member links in the app. */
export function GET() {
  return Response.json(
    {
      applinks: {
        apps: [],
        details: [
          {
            appID: "GDNRT9DJ58.com.cinderandcrown.onehope",
            paths: UNIVERSAL_LINK_PATHS,
          },
        ],
      },
    },
    { headers: { "content-type": "application/json" } },
  );
}
