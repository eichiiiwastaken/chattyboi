import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { getAllowedModelIds } from "@/lib/ai/models";
import { getUserSettings, updateUserSettings } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

const updateSettingsSchema = z.object({
  defaultSearchModel: z.string().optional(),
  webSearchEnabled: z.boolean().optional(),
  statsForNerds: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:settings").toResponse();
  }

  try {
    const userSettings = await getUserSettings({ userId: session.user.id });
    return Response.json(userSettings);
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    return new ChatbotError("offline:settings").toResponse();
  }
}

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:settings").toResponse();
  }

  try {
    const body = await request.json();
    const parsed = updateSettingsSchema.parse(body);

    if (parsed.defaultSearchModel) {
      const allowedModelIds = await getAllowedModelIds();
      if (!allowedModelIds.has(parsed.defaultSearchModel)) {
        return new ChatbotError(
          "bad_request:api",
          "Invalid default search model."
        ).toResponse();
      }
    }

    await updateUserSettings({
      userId: session.user.id,
      ...parsed,
    });

    const userSettings = await getUserSettings({ userId: session.user.id });
    return Response.json(userSettings);
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    return new ChatbotError("offline:settings").toResponse();
  }
}
