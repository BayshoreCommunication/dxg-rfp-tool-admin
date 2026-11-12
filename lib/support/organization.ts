// Tickets come from every customer organization, and ticket numbers are per organization:
// "#3" alone can be several tickets. These helpers label a ticket with the organization it
// belongs to. They accept a ticket without one, because a backend older than 2026-11-12 does
// not send the field.

type OrganizationLike = { id?: string | null; name?: string | null } | null | undefined;

export const organizationName = (organization: OrganizationLike): string | null => {
  const name = typeof organization?.name === "string" ? organization.name.trim() : "";
  return name || null;
};

const OBJECT_ID = /^[0-9a-f]{24}$/i;

/** The inbox narrowed to one organization, or null when the ticket's organization is not known. */
export const organizationInboxHref = (organization: OrganizationLike): string | null => {
  const id = typeof organization?.id === "string" ? organization.id.trim() : "";
  return OBJECT_ID.test(id) ? `/support?status=all&organization=${id.toLowerCase()}` : null;
};

/** Only a well-formed organization id is sent to the backend as a filter. */
export const organizationFilter = (value: string | null | undefined): string =>
  typeof value === "string" && OBJECT_ID.test(value.trim()) ? value.trim().toLowerCase() : "";
