import type { Command } from "@/features/alliance-event/types";
import {
  bearer,
  eventBody,
  eventError,
  eventResponse,
} from "@/features/alliance-event/server/http";
import {
  readLocalEvent,
  writeLocalEvent,
} from "@/features/alliance-event/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    return eventResponse(
      await readLocalEvent((await context.params).id, bearer(request)),
    );
  } catch (error) {
    return eventError(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const body = await eventBody(request);
    return eventResponse(
      await writeLocalEvent(
        (await context.params).id,
        bearer(request) ?? "",
        body.version as number,
        body.requestId as string,
        body.command as Command,
      ),
    );
  } catch (error) {
    return eventError(error);
  }
}
