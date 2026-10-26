"use server";

import { revalidatePath } from "next/cache";

import { BACKEND_URL } from "@/lib/config";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";

export type SupportTicketStatus = "open" | "waiting_on_customer" | "resolved" | "closed";
export type SupportTicketPriority = "low" | "normal" | "high" | "urgent";
export type SupportTicketCategory = "how_to" | "bug" | "billing" | "vendor_email" | "other";

export interface SupportUserSummary {
  id: string;
  name: string;
  email: string;
  company: string | null;
  role: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: number;
  requesterUserId: string;
  assigneeUserId: string | null;
  subject: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  messageCount: number;
  unreadForRequester: number;
  unreadForAgents: number;
  lastMessageAt: string;
  lastCustomerMessageAt: string | null;
  lastAgentMessageAt: string | null;
  firstAgentResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  /** When the latest customer message must be answered by; null when nothing is owed. */
  responseDueAt?: string | null;
  escalatedAt?: string | null;
  waitingSince?: string | null;
  autoCloseReminderSentAt?: string | null;
  createdAt: string;
  updatedAt: string;
  requester?: SupportUserSummary | null;
  assignee?: SupportUserSummary | null;
}

export interface SupportAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  objectKey: string;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  authorUserId: string | null;
  authorRole: "customer" | "agent" | "system";
  kind: "message" | "internal_note" | "system";
  body: string;
  attachments: SupportAttachment[];
  createdAt: string;
  author?: SupportUserSummary | null;
}

export interface SupportPagination {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface SupportInboxFilters {
  status?: string;
  assignee?: string;
  priority?: string;
  category?: string;
  search?: string;
  sort?: "urgency" | "recent";
  page?: number;
  perPage?: number;
}

export interface SupportMetrics {
  open: number;
  waitingOnCustomer: number;
  resolved: number;
  closed: number;
  unassigned: number;
  unreadForAgents: number;
  overdue?: number;
  averageFirstResponseMs: number | null;
  averageResolutionMs: number | null;
  perAgent: Array<{ agentUserId: string; openTickets: number; agent: SupportUserSummary | null }>;
}

export interface SupportCannedReply {
  id: string;
  title: string;
  body: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export type SupportActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

const base = `${BACKEND_URL}/api/v1/admin/support`;

const call = async <T,>(
  path: string,
  init?: RequestInit,
): Promise<SupportActionResult<T>> => {
  try {
    const response = await authenticatedBackendFetch(`${base}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const result = (await response.json().catch(() => null)) as
      | { success?: boolean; data?: T; message?: string; code?: string }
      | null;
    if (!response.ok || !result?.success) {
      return {
        ok: false,
        error: result?.message || `The support desk request failed (HTTP ${response.status}).`,
        code: result?.code,
      };
    }
    return { ok: true, data: result.data as T };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Network error" };
  }
};

const revalidateSupport = (ticketId?: string) => {
  revalidatePath("/support");
  revalidatePath("/dashboard");
  if (ticketId) revalidatePath(`/support/${ticketId}`);
};

export async function listSupportTicketsAction(
  filters: SupportInboxFilters = {},
): Promise<SupportActionResult<{ tickets: SupportTicket[]; pagination: SupportPagination }>> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }
  const suffix = query.toString();
  return call(`/tickets${suffix ? `?${suffix}` : ""}`);
}

export async function getSupportTicketAction(
  ticketId: string,
): Promise<
  SupportActionResult<{
    ticket: SupportTicket;
    requester: SupportUserSummary | null;
    assignee: SupportUserSummary | null;
    messages: SupportMessage[];
  }>
> {
  return call(`/tickets/${encodeURIComponent(ticketId)}`);
}

export async function getSupportMetricsAction(): Promise<SupportActionResult<SupportMetrics>> {
  return call("/metrics");
}

export async function listSupportAgentsAction(): Promise<SupportActionResult<SupportUserSummary[]>> {
  return call("/agents");
}

export async function replySupportTicketAction(
  ticketId: string,
  input: { body: string; status?: SupportTicketStatus; attachments?: string[] },
): Promise<SupportActionResult<{ ticket: SupportTicket; message: SupportMessage }>> {
  const result = await call<{ ticket: SupportTicket; message: SupportMessage }>(
    `/tickets/${encodeURIComponent(ticketId)}/messages`,
    { method: "POST", body: JSON.stringify(input) },
  );
  if (result.ok) revalidateSupport(ticketId);
  return result;
}

export async function addSupportNoteAction(
  ticketId: string,
  body: string,
): Promise<SupportActionResult<SupportMessage>> {
  const result = await call<SupportMessage>(`/tickets/${encodeURIComponent(ticketId)}/notes`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  if (result.ok) revalidateSupport(ticketId);
  return result;
}

export async function updateSupportTicketAction(
  ticketId: string,
  patch: {
    assigneeUserId?: string | null;
    priority?: SupportTicketPriority;
    category?: SupportTicketCategory;
    status?: SupportTicketStatus;
    subject?: string;
  },
): Promise<SupportActionResult<SupportTicket>> {
  const result = await call<SupportTicket>(`/tickets/${encodeURIComponent(ticketId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (result.ok) revalidateSupport(ticketId);
  return result;
}

export async function listCannedRepliesAction(): Promise<SupportActionResult<SupportCannedReply[]>> {
  return call("/canned-replies");
}

export async function createCannedReplyAction(input: {
  title: string;
  body: string;
}): Promise<SupportActionResult<SupportCannedReply>> {
  const result = await call<SupportCannedReply>("/canned-replies", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (result.ok) revalidatePath("/support/canned-replies");
  return result;
}

export async function updateCannedReplyAction(
  id: string,
  input: { title?: string; body?: string },
): Promise<SupportActionResult<SupportCannedReply>> {
  const result = await call<SupportCannedReply>(`/canned-replies/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (result.ok) revalidatePath("/support/canned-replies");
  return result;
}

export async function deleteCannedReplyAction(id: string): Promise<SupportActionResult<{ deleted: boolean }>> {
  const result = await call<{ deleted: boolean }>(`/canned-replies/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (result.ok) revalidatePath("/support/canned-replies");
  return result;
}

export type SupportPresenceOther = { userId: string; name: string; state: "viewing" | "replying" };

/** Heartbeat for "who else has this ticket open"; returns the other agents. */
export async function supportPresenceAction(
  ticketId: string,
  state: "viewing" | "replying",
): Promise<SupportActionResult<{ others: SupportPresenceOther[] }>> {
  return call(`/tickets/${encodeURIComponent(ticketId)}/presence`, {
    method: "POST",
    body: JSON.stringify({ state }),
  });
}

export async function leaveSupportPresenceAction(ticketId: string): Promise<SupportActionResult<{ left: boolean }>> {
  return call(`/tickets/${encodeURIComponent(ticketId)}/presence`, { method: "DELETE" });
}
