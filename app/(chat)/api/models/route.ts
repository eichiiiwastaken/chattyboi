import { connection } from "next/server";
import {
  fetchAllModelData,
  type GatewayModelWithCapabilities,
} from "@/lib/ai/models";

export async function GET() {
  await connection();

  const headers = {
    "Cache-Control": "no-store, max-age=0",
  };

  const { allModels, capabilities } = await fetchAllModelData();

  const models: GatewayModelWithCapabilities[] = allModels.map((m) => ({
    ...m,
    capabilities: capabilities[m.id] ?? {
      tools: true,
      vision: false,
      file: false,
      reasoning: true,
    },
  }));

  return Response.json({ capabilities, models }, { headers });
}
