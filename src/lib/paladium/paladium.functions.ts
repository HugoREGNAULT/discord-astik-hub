import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchPaladium } from "./paladium.server";

// Single proxy server function. The client passes the Paladium API path
// (e.g. "/v1/status") and the server forwards it using PALADIUM_API_KEY.
export const callPaladium = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        path: z
          .string()
          .min(1)
          .max(512)
          // Only allow whitelisted Paladium API paths
          .regex(/^\/v1\/[A-Za-z0-9\-_./%]+$/),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const result = await fetchPaladium(data.path);
    // Serialize as a JSON string to bypass strict structural serialization checks
    // (Paladium responses have dynamic shapes).
    return { json: JSON.stringify(result ?? null) };
  });
