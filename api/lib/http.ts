import type { VercelResponse } from "@vercel/node";

export function sendJson(response: VercelResponse, statusCode: number, body: unknown) {
  response.status(statusCode).setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}

export function sendMethodNotAllowed(response: VercelResponse) {
  sendJson(response, 405, { error: "Method not allowed" });
}
