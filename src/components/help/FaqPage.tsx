import { auth } from '@/lib/auth';
import { faqSetForRole } from '@/lib/help/faqContent';
import { FaqList } from '@/components/help/FaqList';

/** Shared by every role's /faq route. The role-specific layout above it has
 * already established the session, so the set resolves here and only that one
 * set is ever handed to the client - there is no audience toggle in the UI. */
export async function FaqPage() {
  const session = await auth();
  const faq = faqSetForRole(session?.user?.role as string | undefined);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-[#1B2A6B] sm:text-3xl">{faq.heading}</h1>
      <p className="mt-2 text-sm text-text-secondary">{faq.intro}</p>
      <FaqList items={faq.items} />
    </div>
  );
}
