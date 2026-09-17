import { redirect } from 'next/navigation';

/**
 * Compliance was the register a second time.
 *
 * It queried all 32,579 schools, paginated them, filtered them by district and management, and
 * printed School, District, Block and Management before its own column — the same four columns
 * the Schools register already prints. What it added was a profile status built from address,
 * public phone, fee disclosure and mandatory documents.
 *
 * Two of those four come from the UDISE+ extract rather than from the school, so "not started"
 * was a status no school could stay in once the import lands. The one that matters to an
 * official reading a register is whether the school has filled its SQAAF, and the register was
 * already carrying that as an unexplained dash in the self assessment column. It says so now.
 *
 * Mandatory documents are no longer reported across the register by SSSA's decision; they stay
 * visible on a school's own record. Fee disclosure keeps its column on the register, where it
 * already was.
 *
 * The redirect stays because the URL was in production, the same reason /app/sssa/escalations
 * and /app/verifier/recording-tasks still redirect.
 */
export default function CompliancePageRedirect() {
  redirect('/app/sssa/schools');
}
