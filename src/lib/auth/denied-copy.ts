/** Why someone signed in can't use Tally Sheet, shown on the sign-in and No access pages. */
export const DENIED_COPY: Record<string, string> = {
  no_access: "Your account doesn't have access to Tally Sheet yet. Request it from the Lam Soon PSG Portal.",
  pending: "Your request for Tally Sheet is waiting for approval.",
  suspended: "Your Tally Sheet access is suspended. Ask your administrator.",
  revoked: "Your Tally Sheet access was removed. Ask your administrator.",
  inactive: "Your Portal account isn't active.",
  no_role: "You have access but no role yet. Ask an administrator to give you the Worker or Office role.",
  worker_only: "This page is for warehouse workers.",
  office_only: "This page is for office staff.",
};
