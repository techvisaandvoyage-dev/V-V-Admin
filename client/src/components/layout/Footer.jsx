// ============================================================
//  Footer Component
//  Landing page footer: CMS links, social icons, trust badges.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Plane, Mail, Shield, Lock, Globe } from "lucide-react";
import { api } from "../../store/authStore";

const FOOTER_SECTIONS = [
  { key: "company", title: "Company" },
  { key: "services", title: "Services" },
  { key: "support", title: "Support" },
  { key: "legal", title: "Legal" },
];

const InstagramIcon = ({ size = 16, className = "" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    width={size}
    height={size}
    aria-hidden="true"
  >
    <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
    <circle cx="12" cy="12" r="4.2" />
    <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const FacebookIcon = ({ size = 16, className = "" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    width={size}
    height={size}
    aria-hidden="true"
  >
    <path d="M13.5 21v-7h2.4l.36-2.76H13.5V9.48c0-.8.22-1.35 1.37-1.35h1.47V5.66c-.25-.03-1.11-.11-2.11-.11-2.09 0-3.52 1.27-3.52 3.61v2.08H8.34V14h2.37v7h2.79Z" />
  </svg>
);

const TwitterIcon = ({ size = 16, className = "" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    width={size}
    height={size}
    aria-hidden="true"
  >
    <path d="M18.9 3H22l-6.77 7.74L23 21h-6.08l-4.76-6.22L6.72 21H3.6l7.24-8.28L1 3h6.23l4.3 5.68L18.9 3Zm-1.07 16.18h1.69L6.31 4.73H4.5l13.33 14.45Z" />
  </svg>
);

const Footer = () => {
  const location = useLocation();
  const isTransientPage =
    location.pathname === "/login" ||
    location.pathname === "/register" ||
    location.pathname.startsWith("/apply") ||
    location.pathname.endsWith("/summary");
  const currentYear = new Date().getFullYear();
  const [pages, setPages] = useState([]);

  useEffect(() => {
    let active = true;

    const loadFooterPages = async () => {
      try {
        const { data } = await api.get("/pages");
        if (active && data.success) {
          setPages(Array.isArray(data.items) ? data.items : []);
        }
      } catch {
        if (active) setPages([]);
      }
    };

    loadFooterPages();
    return () => {
      active = false;
    };
  }, []);

  const columns = useMemo(
    () =>
      FOOTER_SECTIONS.map((section) => ({
        ...section,
        links: pages
          .filter((page) => (page.footerSection || "company") === section.key)
          .map((page) => ({
            label: page.title,
            to: `/page/${page.slug}`,
          })),
      })),
    [pages]
  );

  const trustBadges = [
    { icon: Shield, label: "SSL Secured" },
    { icon: Lock, label: "Data Protected" },
    { icon: Globe, label: "150+ Countries" },
  ];

  return (
    <footer className="bg-surface border-t border-border" id="footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          <div className="lg:col-span-1">
            <Link to="/" replace className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-cyan flex items-center justify-center">
                <Plane size={16} className="text-background" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-xl">
                Visa & <span className="text-gradient-cyan">Voyage</span>
              </span>
            </Link>
            <p className="text-sm text-text-secondary leading-relaxed mb-6">
              Your trusted partner for seamless visa applications worldwide.
              Fast, secure, and professionally managed.
            </p>

            <div className="flex items-center gap-3">
              {[
                { icon: InstagramIcon, href: "#", label: "Instagram" },
                { icon: FacebookIcon, href: "#", label: "Facebook" },
                { icon: Mail, href: "mailto:", label: "Email" },
                { icon: TwitterIcon, href: "#", label: "Twitter" },
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-text-muted hover:text-cyan hover:border-cyan/30 transition-all duration-200"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.key}>
              <h3 className="text-sm font-semibold text-text-primary mb-4">{col.title}</h3>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      replace={isTransientPage}
                      state={{
                        from: `${location.pathname}${location.search}${location.hash}`,
                      }}
                      className="text-sm text-text-secondary hover:text-cyan transition-colors duration-200"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
                {col.links.length === 0 && (
                  <li className="text-sm text-text-muted">No pages yet</li>
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <p className="text-sm text-text-muted">
              &copy; {currentYear} Visa & Voyage. All rights reserved.
            </p>

            <div className="flex items-center gap-6">
              {trustBadges.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-xs text-text-muted">
                  <Icon size={14} className="text-cyan flex-shrink-0" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
