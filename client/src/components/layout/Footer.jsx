// ============================================================
//  Footer Component
//  Landing page footer: links, social icons, trust badges.
// ============================================================
import { Link } from "react-router-dom";
import { Plane, Mail, MessageCircle, Link as LinkIcon, Shield, Lock, Globe } from "lucide-react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  // ── Footer navigation columns ─────────────────────────────
  const columns = [
    {
      title: "Company",
      links: [
        { label: "About Us",     href: "#" },
        { label: "Careers",      href: "#" },
        { label: "Press",        href: "#" },
        { label: "Blog",         href: "#" },
      ],
    },
    {
      title: "Services",
      links: [
        { label: "Tourist Visas",   href: "#" },
        { label: "Business Visas",  href: "#" },
        { label: "Student Visas",   href: "#" },
        { label: "Work Permits",    href: "#" },
      ],
    },
    {
      title: "Support",
      links: [
        { label: "Help Center",       href: "#" },
        { label: "Track Application", href: "#" },
        { label: "Contact Us",        href: "#" },
        { label: "FAQ",               href: "#" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy",   href: "#" },
        { label: "Terms of Service", href: "#" },
        { label: "Cookie Policy",    href: "#" },
        { label: "Refund Policy",    href: "#" },
      ],
    },
  ];

  // ── Trust badges ──────────────────────────────────────────
  const trustBadges = [
    { icon: Shield, label: "SSL Secured" },
    { icon: Lock,   label: "Data Protected" },
    { icon: Globe,  label: "150+ Countries" },
  ];

  return (
    <footer className="bg-surface border-t border-border" id="footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        {/* ── Top: Brand + columns ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 mb-4">
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

            {/* Social links */}
            <div className="flex items-center gap-3">
              {[
                { icon: Mail,  href: "#", label: "Email" },
                { icon: LinkIcon, href: "#", label: "Website" },
                { icon: MessageCircle,   href: "#", label: "Chat" },
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

          {/* Nav columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-text-primary mb-4">{col.title}</h3>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-text-secondary hover:text-cyan transition-colors duration-200"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Divider ── */}
        <div className="border-t border-border pt-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            {/* Copyright */}
            <p className="text-sm text-text-muted">
              © {currentYear} {atob("VmlzYSAmIFZveWFnZSBieSBZYXNoIFJhaiBTaW5naC4=")} {atob("QWxsIHJpZ2h0cyByZXNlcnZlZC4gTGljZW5zZWQgZm9yIHBlcnNvbmFsIHVzZSBvbmx5OyByZXNhbGUgb3IgdW5hdXRob3JpemVkIHJlZGlzdHJpYnV0aW9uIGlzIHN0cmljdGx5IHByb2hpYml0ZWQu")}
            </p>

            {/* Trust badges */}
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
