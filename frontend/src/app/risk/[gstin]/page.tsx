import VendorScorecardClient from "./VendorScorecardClient";

// Required for Next.js static export (output: 'export').
// Returns a placeholder param so the route is included in the build.
// Actual vendor pages are accessed via /risk/vendor?gstin= (search params).
export async function generateStaticParams() {
  return [{ gstin: "_" }];
}

export const dynamicParams = false;

export default function VendorScorecardPage() {
  return <VendorScorecardClient />;
}
