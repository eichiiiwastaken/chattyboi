import { connection } from "next/server";
import {
  fetchAllModelData,
  type GatewayModelWithCapabilities,
} from "@/lib/ai/models";

export async function GET() {
  await connection();

  const headers = {
    "Cache-Control": "public, max-age=300, s-maxage=300",
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
