import {
  eventBody,
  eventError,
  eventResponse,
} from "@/features/alliance-event/server/http";
import {
  localEventEnabled,
  newLocalEvent,
} from "@/features/alliance-event/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return eventResponse({ available: localEventEnabled() });
}
export async function POST(request: Request) {
  try {
    const body = await eventBody(request);
    return eventResponse(await newLocalEvent(body.demo === true), 201);
  } catch (error) {
    return eventError(error);
  }
}
