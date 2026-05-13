/**
 * Seed default static (CMS) pages on first boot.
 *
 * This module is intentionally idempotent and conservative:
 *  - It only inserts a page when one with that slug does NOT exist.
 *  - It NEVER overwrites an existing page (admins may have edited it).
 *  - It logs a soft message on failure but never throws — failing to seed a
 *    marketing page must not prevent the API server from starting.
 *
 * Currently seeds:
 *   • "Terms and Conditions" (slug: terms-and-conditions)
 *       → appears in the footer "Legal" column and is the target of the
 *         `/terms` route used by the application summary / country pages.
 *
 * Admins can edit the page text/SEO/visibility via:
 *   Admin Dashboard → CMS → Static Pages → "Terms and Conditions" → Edit
 */

const StaticPage = require('./models/StaticPage');

const DEFAULT_TERMS_CONTENT = `
<h2>1. Acceptance of Terms</h2>
<p>
  By accessing or using the Visa &amp; Voyage website, mobile experience or
  related services (collectively, the "Service"), you confirm that you have
  read, understood and agree to be bound by these Terms and Conditions. If you
  do not agree, please discontinue using the Service immediately.
</p>

<h2>2. Service Overview</h2>
<p>
  Visa &amp; Voyage is a visa concierge platform. We help travellers prepare,
  organise and submit visa applications. We are <strong>not</strong> a
  government body and we do not grant visas — decisions on every application
  rest solely with the relevant embassy, consulate or immigration authority.
</p>

<h2>3. Fees &amp; Payments</h2>
<ul>
  <li>The amount shown on the payment summary covers our <strong>service charges</strong> only.</li>
  <li>Government / embassy / VAC fees (where applicable) are paid separately and may change without notice.</li>
  <li>All payments are processed through trusted third-party gateways (e.g. Razorpay). We never store your card details on our servers.</li>
  <li>Service charges are non-refundable once your application has been reviewed by our team.</li>
</ul>

<h2>4. Documents &amp; Accuracy of Information</h2>
<p>
  You are responsible for the accuracy, completeness and authenticity of every
  document and detail you submit. Misrepresentation, forgery or submission of
  documents that do not belong to the traveller may lead to refusal by the
  embassy and forfeiture of all fees.
</p>

<h2>5. Processing Times</h2>
<p>
  Processing timelines shown on country pages are <em>indicative averages</em>
  published by the issuing authority. Actual processing may take longer due to
  embassy workload, document verification, public holidays or additional
  checks. Visa &amp; Voyage is not liable for delays outside our control.
</p>

<h2>6. Cancellations &amp; Refunds</h2>
<ul>
  <li>You may cancel an unsubmitted application at any time from your dashboard.</li>
  <li>Once the application has been forwarded to the embassy or its appointed VAC, service fees become non-refundable.</li>
  <li>Refunds for embassy / government fees (if any) are governed entirely by the issuing authority's policy.</li>
</ul>

<h2>7. User Account &amp; Security</h2>
<p>
  You agree to keep your login credentials confidential and to notify us
  promptly of any unauthorised access. Visa &amp; Voyage may suspend or
  terminate accounts that violate these Terms, attempt to defraud the platform
  or behave abusively towards our staff or other users.
</p>

<h2>8. Intellectual Property</h2>
<p>
  All content on the Service — including text, graphics, logos, country guides
  and software — is owned by or licensed to Visa &amp; Voyage and is protected
  by applicable intellectual property laws. You may not copy, reproduce or
  redistribute it without our prior written consent.
</p>

<h2>9. Limitation of Liability</h2>
<p>
  To the maximum extent permitted by law, Visa &amp; Voyage shall not be
  liable for any indirect, incidental, special or consequential damages —
  including missed travel, denied entry, embassy rejections, or losses arising
  from delays — even where we have been advised of the possibility of such
  damages. Our total liability for any claim will not exceed the service fee
  paid by you for the specific application giving rise to the claim.
</p>

<h2>10. Privacy</h2>
<p>
  Your personal data is handled in accordance with our Privacy Policy. We use
  industry-standard encryption to protect uploaded passports, identity proofs
  and supporting documents.
</p>

<h2>11. Changes to These Terms</h2>
<p>
  We may update these Terms from time to time to reflect changes in our
  services, legal requirements or business practices. The latest version will
  always be available at this page. Continued use of the Service after a
  revision means you accept the updated Terms.
</p>

<h2>12. Contact</h2>
<p>
  Questions about these Terms? Reach our support team via the contact details
  available in your dashboard or in the footer of every page.
</p>

<p><em>Last updated: ${new Date().toISOString().slice(0, 10)}</em></p>
`.trim();

const DEFAULT_PAGES = [
  {
    title: 'Terms and Conditions',
    slug: 'terms-and-conditions',
    summary:
      'The legal terms governing your use of Visa & Voyage — fees, refunds, processing timelines and account responsibilities.',
    content: DEFAULT_TERMS_CONTENT,
    template: 'legal',
    footerSection: 'legal',
    status: 'published',
    seo: {
      metaTitle: 'Terms and Conditions | Visa & Voyage',
      metaDescription:
        'Read the Terms and Conditions for Visa & Voyage — covering service fees, document responsibilities, refunds and limitations of liability.',
      keywords: ['terms', 'conditions', 'legal', 'visa & voyage'],
      canonicalUrl: '',
      openGraphImage: '',
    },
  },
];

const seedStaticPages = async () => {
  let inserted = 0;
  for (const seed of DEFAULT_PAGES) {
    try {
      const existing = await StaticPage.findOne({ slug: seed.slug }).select('_id');
      if (existing) continue;

      await StaticPage.create({
        ...seed,
        publishedAt: seed.status === 'published' ? new Date() : null,
      });
      inserted += 1;
    } catch (err) {
      // Soft-fail per page so a single bad seed never blocks the server boot.
      console.log(`Skipping static-page seed for "${seed.slug}":`, err.message);
    }
  }

  if (inserted > 0) {
    console.log(`Seeded ${inserted} default static page(s).`);
  }
};

module.exports = { seedStaticPages };
