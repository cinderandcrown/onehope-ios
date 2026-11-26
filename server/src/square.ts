/**
 * Square calls for Revival Coffee order-ahead. The access token never leaves
 * the server. Card numbers are not accepted; the client sends a Square nonce
 * (`cnon:`) from the Web Payments SDK or the In-App Payments SDK.
 *
 * What the shop owner grants (do not commit any of these):
 * - Prefer an OAuth app so the token can be revoked in the Square dashboard.
 *   A personal access token is enough for one location while they pilot.
 * - Scopes: ITEMS_READ, ORDERS_WRITE, ORDERS_READ, PAYMENTS_WRITE, PAYMENTS_READ,
 *   MERCHANT_PROFILE_READ.
 * - Location ID of the Richardson shop (SQUARE_LOCATION_ID).
 * - Application ID (public) for the Web Payments SDK (SQUARE_APPLICATION_ID).
 * - Webhook signature key (SQUARE_WEBHOOK_SIGNATURE_KEY) and the notification
 *   URL registered in Square (SQUARE_WEBHOOK_NOTIFICATION_URL), if they want
 *   payment updates. The webhook is optional; orders still record the payment
 *   response.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export type SquareSettings = {
  orderingLive: boolean;
  accessToken: string;
  locationId: string;
  applicationId: string;
  environment: "sandbox" | "production";
  webhookSignatureKey: string;
  webhookNotificationUrl: string;
};

export type SquareVariation = {
  catalogObjectId: string;
  name: string;
  variation: string;
  priceCents: number | null;
};

export function squareSettings(env: {
  coffeeOrderingLive: boolean;
  squareAccessToken: string;
  squareLocationId: string;
  squareApplicationId: string;
  squareEnvironment: string;
  squareWebhookSignatureKey: string;
  squareWebhookNotificationUrl: string;
}): SquareSettings {
  const environment = env.squareEnvironment === "production" ? "production" : "sandbox";
  const ready = env.coffeeOrderingLive && env.squareAccessToken.length > 0 && env.squareLocationId.length > 0;
  return {
    orderingLive: ready,
    accessToken: env.squareAccessToken,
    locationId: env.squareLocationId,
    applicationId: env.squareApplicationId,
    environment,
    webhookSignatureKey: env.squareWebhookSignatureKey,
    webhookNotificationUrl: env.squareWebhookNotificationUrl,
  };
}

export function squareHost(environment: SquareSettings["environment"]): string {
  return environment === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

export function squareSignature(key: string, notificationUrl: string, rawBody: string): string {
  return createHmac("sha256", key)
    .update(notificationUrl + rawBody)
    .digest("base64");
}

export function verifySquareSignature(
  key: string,
  notificationUrl: string,
  rawBody: string,
  signature: string,
): boolean {
  if (!key || !notificationUrl || !signature) return false;
  const expected = squareSignature(key, notificationUrl, rawBody);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

type FetchLike = typeof fetch;

async function squareFetch(fetchImpl: FetchLike, settings: SquareSettings, path: string, init: RequestInit) {
  const response = await fetchImpl(`${squareHost(settings.environment)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${settings.accessToken}`,
      "Square-Version": "2024-10-17",
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error("Square refused the request.");
  }
  return body;
}

export async function listSquareVariations(
  fetchImpl: FetchLike,
  settings: SquareSettings,
): Promise<SquareVariation[]> {
  const body = (await squareFetch(fetchImpl, settings, "/v2/catalog/list?types=ITEM", { method: "GET" })) as {
    objects?: {
      type?: string;
      item_data?: {
        name?: string;
        variations?: {
          id?: string;
          item_variation_data?: { name?: string; price_money?: { amount?: number } };
        }[];
      };
    }[];
  };
  const items: SquareVariation[] = [];
  for (const object of body.objects ?? []) {
    if (object.type !== "ITEM") continue;
    const name = object.item_data?.name ?? "Item";
    for (const variation of object.item_data?.variations ?? []) {
      if (!variation.id) continue;
      items.push({
        catalogObjectId: variation.id,
        name,
        variation: variation.item_variation_data?.name ?? "",
        priceCents: variation.item_variation_data?.price_money?.amount ?? null,
      });
    }
  }
  return items;
}

export async function createSquareOrder(
  fetchImpl: FetchLike,
  settings: SquareSettings,
  input: { idempotencyKey: string; lines: { catalogObjectId: string; quantity: number }[] },
): Promise<{ orderId: string; totalCents: number }> {
  const body = (await squareFetch(fetchImpl, settings, "/v2/orders", {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: input.idempotencyKey,
      order: {
        location_id: settings.locationId,
        line_items: input.lines.map((line) => ({
          catalog_object_id: line.catalogObjectId,
          quantity: String(line.quantity),
        })),
      },
    }),
  })) as { order?: { id?: string; total_money?: { amount?: number } } };
  const orderId = body.order?.id;
  if (!orderId) throw new Error("Square did not return an order.");
  return { orderId, totalCents: body.order?.total_money?.amount ?? 0 };
}

export async function createSquarePayment(
  fetchImpl: FetchLike,
  settings: SquareSettings,
  input: { sourceId: string; orderId: string; amountCents: number; idempotencyKey: string },
): Promise<{ paymentId: string; status: string }> {
  const body = (await squareFetch(fetchImpl, settings, "/v2/payments", {
    method: "POST",
    body: JSON.stringify({
      source_id: input.sourceId,
      idempotency_key: input.idempotencyKey,
      amount_money: { amount: input.amountCents, currency: "USD" },
      order_id: input.orderId,
      location_id: settings.locationId,
    }),
  })) as { payment?: { id?: string; status?: string } };
  if (!body.payment?.id) throw new Error("Square did not return a payment.");
  return { paymentId: body.payment.id, status: body.payment.status ?? "UNKNOWN" };
}
