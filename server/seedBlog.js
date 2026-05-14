/**
 * Seed sample blog categories and posts on first boot.
 *
 * Idempotent and safe:
 *  - Only inserts a category/post when the slug is missing.
 *  - Never overwrites or modifies admin-edited data.
 *  - Soft-fails (returns a status object) so server boot is never blocked.
 *
 * The seed exists so the public `/blog` listing has something to show out of
 * the box and the admin "Blog" tab is not empty on first install. Admins can
 * edit, unpublish, or delete every seeded post from the Admin → Blog tab.
 */

const BlogCategory = require('./models/BlogCategory');
const BlogPost = require('./models/BlogPost');
const Admin = require('./models/Admin');
const { slugify } = require('./utils/slugify');

const SAMPLE_CATEGORIES = [
  { name: 'Visa News', order: 1 },
  { name: 'Travel Updates', order: 2 },
  { name: 'Country Guides', order: 3 },
  { name: 'Air India', order: 4 },
  { name: 'Immigration News', order: 5 },
  { name: 'Student Visa', order: 6 },
  { name: 'Work Visa', order: 7 },
  { name: 'Tourist Visa', order: 8 },
];

/**
 * Each sample post references its category by slug (looked up at insert time).
 * `body` becomes a single `paragraph` section; admin can re-edit later and
 * append richer section types via the API.
 */
const SAMPLE_POSTS = [
  {
    title: 'Air India New Visa Rules for International Travellers',
    categorySlug: 'air-india',
    thumbnail:
      'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=900&q=70',
    bannerImage:
      'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1600&q=70',
    shortDescription:
      'Air India has rolled out updated documentation requirements for travellers transiting through major hubs. Here is what every passenger needs to know before booking.',
    tags: ['air-india', 'visa-news', 'travel'],
    featured: true,
    body: `Air India has updated its passenger documentation checks following revised guidance from international transit authorities. Travellers connecting through Delhi, Mumbai and Bengaluru are now expected to carry the original visa document — not just a printed copy — along with a passport that has at least six months of validity.

The airline has also added new e-visa verification at the boarding gate for select destinations including the UAE, Singapore and Schengen states. Visa & Voyage will keep this article updated as the airline publishes more detail.`,
  },
  {
    title: 'Canada Student Visa Update: Faster Approvals for SDS Applicants',
    categorySlug: 'student-visa',
    thumbnail:
      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=900&q=70',
    bannerImage:
      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1600&q=70',
    shortDescription:
      'IRCC announced quicker SDS turnaround times for Indian students. Find out the new biometrics window and how to prepare your file.',
    tags: ['canada', 'student-visa', 'sds'],
    featured: true,
    body: `Immigration, Refugees and Citizenship Canada (IRCC) has confirmed that Student Direct Stream (SDS) processing times will be reduced for complete applications from India. Applicants who provide the required GIC, language scores and tuition deposits up front are seeing decisions in as little as 20 calendar days.

Visa & Voyage recommends submitting biometrics within 72 hours of receiving the BIL, and uploading the complete document set in one go — partial uploads remain the top reason for delays.`,
  },
  {
    title: 'Dubai Tourist Visa Process: 2026 Step-by-Step Guide',
    categorySlug: 'tourist-visa',
    thumbnail:
      'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=900&q=70',
    bannerImage:
      'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1600&q=70',
    shortDescription:
      'Everything you need to plan your Dubai vacation — eligibility, document list, fees and the typical processing window for the 30-day tourist visa.',
    tags: ['dubai', 'tourist-visa', 'uae'],
    body: `The Dubai tourist visa remains one of the fastest visas to obtain for Indian passport holders. Standard 30-day visas are processed within 3-5 working days when applications are filed by an approved sponsor or airline partner.

Required documents include a passport with at least six months of validity, a confirmed return ticket, and proof of accommodation. Visa & Voyage's checklist tool pre-verifies your photo and passport scan before submission to cut down on rejections.`,
  },
  {
    title: 'Schengen Visa Delay News: What Indian Applicants Should Expect',
    categorySlug: 'visa-news',
    thumbnail:
      'https://images.unsplash.com/photo-1493558103817-58b2924bce98?auto=format&fit=crop&w=900&q=70',
    bannerImage:
      'https://images.unsplash.com/photo-1493558103817-58b2924bce98?auto=format&fit=crop&w=1600&q=70',
    shortDescription:
      'Appointment slots across France, Germany and Italy are tight this season. We break down the realistic timelines, alternate consulates and our advice to avoid summer chaos.',
    tags: ['schengen', 'visa-news', 'europe'],
    featured: true,
    body: `Schengen consulates in India have flagged a heavier-than-usual application volume for the upcoming summer. France and Germany VFS appointment slots in Delhi and Mumbai are booked up to 6 weeks ahead, while Italy has temporarily paused walk-ins.

Visa & Voyage advises planning at least 60 days before travel, considering alternate consulates such as Spain or the Netherlands when itineraries allow, and ensuring your travel insurance meets the 30,000-euro Schengen minimum coverage.`,
  },
  {
    title: 'UK Work Visa Sponsorship: Updated Salary Thresholds Explained',
    categorySlug: 'work-visa',
    thumbnail:
      'https://images.unsplash.com/photo-1486299267070-83823f5448dd?auto=format&fit=crop&w=900&q=70',
    bannerImage:
      'https://images.unsplash.com/photo-1486299267070-83823f5448dd?auto=format&fit=crop&w=1600&q=70',
    shortDescription:
      'The UK Home Office has raised salary floors for sponsored work visas. Find out the new general and shortage occupation thresholds and how they impact applicants.',
    tags: ['uk', 'work-visa', 'sponsorship'],
    body: `The UK Home Office's revised Skilled Worker route increases the general salary threshold and updates the discount available under the Shortage Occupation List. Employers must verify that role salaries meet the new minimums before assigning a Certificate of Sponsorship.

Visa & Voyage's UK desk is helping employers benchmark salaries against the new SOC codes and ensure compliance for upcoming intakes.`,
  },
  {
    title: 'Top 5 Country Guides for First-Time International Travellers',
    categorySlug: 'country-guides',
    thumbnail:
      'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=900&q=70',
    bannerImage:
      'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1600&q=70',
    shortDescription:
      'Travelling abroad for the first time? These five destinations offer easy visas, friendly logistics and unforgettable experiences for new explorers.',
    tags: ['country-guides', 'travel-tips', 'first-time'],
    body: `For first-time travellers, we recommend destinations with simple visa formalities and reliable infrastructure: Thailand, the UAE, Singapore, Indonesia (Bali) and Sri Lanka. Each pairs a tourist-friendly visa pathway with English-friendly airports and well-developed accommodation options.

Visa & Voyage's country pages provide checklists and document templates for each of these destinations, plus optional concierge support for biometrics and submission.`,
  },
  {
    title: 'US H-1B Lottery Outcomes: Key Takeaways for the Year',
    categorySlug: 'immigration-news',
    thumbnail:
      'https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?auto=format&fit=crop&w=900&q=70',
    bannerImage:
      'https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?auto=format&fit=crop&w=1600&q=70',
    shortDescription:
      'USCIS released registration outcomes for this year. Read our breakdown of selection ratios, employer trends and what selected applicants should do next.',
    tags: ['usa', 'h1b', 'immigration'],
    body: `USCIS has completed the H-1B registration selection process. While the overall selection ratio remains tight, the reforms aimed at curbing duplicate registrations show in the slightly improved odds for first-time applicants.

If selected, applicants must work with their petitioning employer to file Form I-129 within the announced filing window, ensuring LCA, supporting evidence and educational evaluations are ready in advance.`,
  },
  {
    title: 'Japan Tourist Visa: New e-Visa Channel for Indian Citizens',
    categorySlug: 'travel-updates',
    thumbnail:
      'https://images.unsplash.com/photo-1490806843957-31f4c9a91c65?auto=format&fit=crop&w=900&q=70',
    bannerImage:
      'https://images.unsplash.com/photo-1490806843957-31f4c9a91c65?auto=format&fit=crop&w=1600&q=70',
    shortDescription:
      'The Embassy of Japan in India has expanded the e-Visa pilot. Learn who is eligible, what documents are required and the expected processing time.',
    tags: ['japan', 'tourist-visa', 'e-visa'],
    body: `Japan's e-Visa channel is now available for Indian passport holders applying for short-term tourist visits. The fully online process replaces in-person submission for eligible travellers and provides decisions within five working days.

Travellers must apply through an accredited travel agency such as Visa & Voyage. We pre-verify your accommodation, return tickets and means of support before final submission.`,
  },
  {
    title: 'Air India Premium Economy Expansion: What Travellers Need to Know',
    categorySlug: 'air-india',
    thumbnail:
      'https://images.unsplash.com/photo-1556388158-158ea5ccacbd?auto=format&fit=crop&w=900&q=70',
    bannerImage:
      'https://images.unsplash.com/photo-1556388158-158ea5ccacbd?auto=format&fit=crop&w=1600&q=70',
    shortDescription:
      'Air India is rolling out Premium Economy on more long-haul routes. We map the new aircraft, routes and what to expect from the upgraded cabin.',
    tags: ['air-india', 'premium-economy', 'flying'],
    body: `Air India's transformation includes a substantial expansion of its Premium Economy product across long-haul destinations in North America, Europe and Australia. The new cabin features wider seats, an enhanced meal service and a dedicated baggage allowance.

If you are travelling on Visa & Voyage's premium concierge plan, our agents can help align flight bookings with your visa interview slots and onward arrangements.`,
  },
];

/** Map category slug → ObjectId, creating missing ones idempotently. */
async function ensureCategories() {
  const slugToId = new Map();
  for (const def of SAMPLE_CATEGORIES) {
    const slug = slugify(def.name);
    let cat = await BlogCategory.findOne({ slug, softDeleted: { $ne: true } });
    if (!cat) {
      cat = await BlogCategory.create({
        name: def.name,
        slug,
        order: def.order,
        isVisible: true,
      });
    }
    slugToId.set(slug, cat._id);
  }
  return slugToId;
}

async function ensurePosts(slugToId, adminId) {
  const inserted = [];
  for (const post of SAMPLE_POSTS) {
    const slug = slugify(post.title);
    const exists = await BlogPost.exists({ slug, softDeleted: { $ne: true } });
    if (exists) continue;

    const categoryId = slugToId.get(post.categorySlug);
    if (!categoryId) continue;

    await BlogPost.create({
      title: post.title,
      slug,
      shortDescription: post.shortDescription,
      thumbnail: post.thumbnail,
      bannerImage: post.bannerImage,
      category: categoryId,
      tags: post.tags || [],
      sections: [
        { type: 'paragraph', order: 0, payload: { text: post.body } },
      ],
      createdByAdmin: adminId,
      status: 'published',
      featured: !!post.featured,
      seoTitle: post.title,
      seoDescription: post.shortDescription,
      publishedAt: new Date(),
    });
    inserted.push(slug);
  }
  return inserted;
}

async function seedBlog() {
  try {
    const admin = await Admin.findOne().select('_id').lean();
    if (!admin) {
      return { ok: false, reason: 'no_admin' };
    }
    const slugToId = await ensureCategories();
    const inserted = await ensurePosts(slugToId, admin._id);
    return {
      ok: true,
      categories: slugToId.size,
      postsInserted: inserted.length,
      insertedSlugs: inserted,
    };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

module.exports = { seedBlog };
