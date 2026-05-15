export const DESTINATION_PAGE_DEFAULT_WHY_BOOK_NOW = [
  "Fast document pre-check by visa specialists",
  "Transparent pricing and status updates",
  "Dedicated support throughout your application",
];

export const DESTINATION_PAGE_DEFAULT_INCLUDED = [
  {
    title: "Application Form Guidance",
    description: "Step-by-step guidance to fill your visa application form accurately and confidently.",
    icon: "ri-file-edit-line",
    color: "blue",
  },
  {
    title: "Document Checklist & Validation",
    description: "We provide a complete checklist and verify your documents to ensure everything is in order.",
    icon: "ri-file-list-3-line",
    color: "green",
  },
  {
    title: "End-to-end Support till Submission",
    description: "Our experts assist you at every step until your application is successfully submitted.",
    icon: "ri-customer-service-2-line",
    color: "purple",
  },
];

export const DESTINATION_PAGE_DEFAULT_FAQS = [
  {
    question: "How long does processing take?",
    answer:
      "Typical processing varies by destination — each country page lists estimated timelines based on current embassy guidance.",
  },
  {
    question: "Can I track my application?",
    answer: "Yes, you can track status updates from your user dashboard after applying.",
  },
  {
    question: "Is this fee refundable?",
    answer: "Government and service fees depend on visa policy and review stage.",
  },
];

export const DESTINATION_PAGE_DEFAULT_HOW_IT_WORKS = [
  { title: "Apply with SprintVisa", description: "Upload your documents on SprintVisa or share over WhatsApp with our visa expert." },
  { title: "Experts review the documents", description: "Our visa experts will verify your documents." },
  { title: "Prepare the application", description: "Our visa expert will help you create the application for document submission." },
  { title: "Visit the Visa Application Center", description: "Traveller visits their nearest Visa Application Center for document submission." },
  { title: "Get your visa", description: "Traveller will collect their passport from VAC or via courier with a stamped visa." },
  { title: "Enjoy your vacation", description: "Thanks for choosing SprintVisa and we wish you an amazing journey." },
];

export const DESTINATION_PAGE_DEFAULT_VISA_REQUIREMENTS = [
  {
    title: "Passport",
    items: [
      "Original passport valid for at least 6 months with two blank pages",
    ]
  },
  {
    title: "Photographs",
    items: [
      "Recent passport-size photograph on white background",
    ]
  },
  {
    title: "Travel Documents",
    items: [
      "Confirmed return flight tickets",
      "Hotel booking or proof of accommodation for the entire stay",
    ]
  },
  {
    title: "Financials",
    items: [
      "Bank statements showing sufficient funds for the trip",
    ]
  }
];

// Note: In Dashboard.jsx, DESTINATION_PAGE_DEFAULT_VISA_REQUIREMENTS was just an array of strings.
// I'll keep it as a flat array if that's how it's used.
export const DESTINATION_PAGE_DEFAULT_VISA_REQUIREMENTS_FLAT = [
  "Original passport valid for at least 6 months with two blank pages",
  "Recent passport-size photograph on white background",
  "Confirmed return flight tickets",
  "Hotel booking or proof of accommodation for the entire stay",
  "Bank statements showing sufficient funds for the trip",
];
