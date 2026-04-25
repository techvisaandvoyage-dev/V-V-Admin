// ============================================================
//  Landing Page
//  Sections:
//  1. Hero — search bar + animated background
//  2. Stats bar — trust numbers
//  3. Trending Destinations — scrollable card grid
//  4. How It Works — 3-step guide
//  5. Testimonials — user reviews
//  6. CTA Banner
// ============================================================
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, MapPin, Calendar, Globe, ArrowRight, Star,
  CheckCircle, Clock, Shield, TrendingUp, Users, FileCheck,
  ChevronRight, Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { COUNTRIES, TRENDING_COUNTRIES } from "../data/countries";

// ── Animation variants ─────────────────────────────────────
const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-50px" },
  transition: { duration: 0.6, ease: "easeOut" },
};

const stagger = {
  initial: {},
  whileInView: {},
  transition: { staggerChildren: 0.1 },
};

// ── HOW IT WORKS steps ─────────────────────────────────────
const HOW_IT_WORKS = [
  {
    step: "01",
    icon: Search,
    title: "Choose Destination",
    description: "Browse 150+ countries. Compare visa types, fees, and processing times side by side.",
    color: "text-cyan",
    bg: "bg-cyan/10",
    border: "border-cyan/20",
  },
  {
    step: "02",
    icon: FileCheck,
    title: "Submit Documents",
    description: "Upload your passport, photos, and supporting documents securely through our encrypted portal.",
    color: "text-gold",
    bg: "bg-gold/10",
    border: "border-gold/20",
  },
  {
    step: "03",
    icon: CheckCircle,
    title: "Get Your Visa",
    description: "We handle the embassy submission. Track your application in real-time and receive updates.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
];

// ── Trust stats ────────────────────────────────────────────
const STATS = [
  { value: "50K+", label: "Applications Processed", icon: FileCheck },
  { value: "150+", label: "Countries Supported",    icon: Globe },
  { value: "98%",  label: "Success Rate",           icon: CheckCircle },
  { value: "24/7", label: "Expert Support",         icon: Shield },
];

// ── Testimonials ───────────────────────────────────────────
const TESTIMONIALS = [
  {
    name: "Sarah Mitchell",
    country: "USA → UK",
    rating: 5,
    text: "Got my UK visa in 4 days. The document checklist saved me hours — everything was approved on first try.",
    role: "Marketing Director",
  },
  {
    name: "Raj Patel",
    country: "India → Schengen",
    rating: 5,
    text: "Applied for a Schengen visa for 5 countries. Visa & Voyage handled every embassy requirement accurately. Incredible service.",
    role: "Software Engineer",
  },
  {
    name: "Maria Santos",
    country: "Brazil → Japan",
    rating: 5,
    text: "The real-time status tracking made the whole process feel transparent. Highly recommend to anyone visiting Japan.",
    role: "Travel Blogger",
  },
];

// ─────────────────────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────────────────────
const LandingPage = () => {
  const navigate = useNavigate();
  const countryCardRefs = useRef({});

  // Search bar state
  const [searchDestination, setSearchDestination] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [searchNationality, setSearchNationality] = useState("");
  const [nationalitiesList, setNationalitiesList] = useState([{ value: "", label: "Your nationality..." }]);

  useEffect(() => {
    const fetchNationalities = async () => {
      try {
        const response = await fetch("https://restcountries.com/v3.1/all?fields=name,cca2,flag");
        if (!response.ok) throw new Error("Failed to fetch");
        const data = await response.json();
        
        const formatted = data.map((country) => ({
          value: country.cca2.toLowerCase(),
          label: `${country.flag} ${country.name.common}`,
        }));

        // Sort alphabetically by country name
        formatted.sort((a, b) => a.label.localeCompare(b.label));
        
        setNationalitiesList([
          { value: "", label: "Your nationality..." },
          ...formatted
        ]);
      } catch (error) {
        console.error("Error fetching nationalities:", error);
        // Fallback or leave empty on error
      }
    };

    fetchNationalities();
  }, []);

  // Tracks whether the user has submitted the search form.
  // When true, the destination cards should show only matching countries.
  const [searchExecuted, setSearchExecuted] = useState(false);

  const searchTerm = searchDestination.trim().toLowerCase();
  const suggestionMatches = searchTerm
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(searchTerm)).slice(0, 5)
    : [];

  // Decide whether to show search-filtered results or the default trending countries.
  const filteredCountries = searchExecuted
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(searchTerm))
    : TRENDING_COUNTRIES;

  // Scroll the selected country card into view in the center of the screen.
  // This prevents the card from appearing only partially visible.
  const scrollToCountry = (countryId) => {
    const card = countryCardRefs.current[countryId];
    if (card?.scrollIntoView) {
      card.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
  };

  // When the user selects a suggestion, update the input value,
  // mark the search as executed, and scroll the matching card into view.
  const handleSuggestionSelect = (country) => {
    setSearchDestination(country.name);
    setSearchExecuted(true);
    setTimeout(() => scrollToCountry(country.id), 150);
  };

  // Search button filters destination cards on the same page rather than routing away.
  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchTerm) {
      setSearchExecuted(false);
      return;
    }

    setSearchExecuted(true);
    const matches = COUNTRIES.filter((c) => c.name.toLowerCase().includes(searchTerm));
    if (matches.length === 1) {
      setTimeout(() => scrollToCountry(matches[0].id), 150);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ════════════════════════════════════════════════════
          SECTION 1: HERO
          ════════════════════════════════════════════════════ */}
      <section
        id="hero"
        className="relative min-h-[92vh] flex items-center justify-center overflow-hidden hero-gradient"
      >
        {/* Background dot pattern */}
        <div className="absolute inset-0 dot-pattern opacity-40" aria-hidden="true" />

        {/* Ambient cyan blob */}
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-20 blur-[120px]"
          style={{ background: "radial-gradient(circle, #00d4ff 0%, transparent 70%)" }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          {/* Pre-headline badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center mb-6"
          >
            <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-cyan/10 border border-cyan/25 text-cyan text-sm font-medium">
              <Zap size={14} fill="currentColor" />
              Trusted by 50,000+ travelers worldwide
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6"
          >
            Your Visa,{" "}
            <span className="text-gradient-cyan">Approved.</span>
            <br />
            <span className="text-text-secondary text-3xl sm:text-4xl lg:text-5xl">
              Effortlessly.
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Visa & Voyage processes your visa application with 98% approval rate.
            Expert guidance, real-time tracking, and zero embassy queues.
          </motion.p>

          {/* ── Search Widget ── */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="w-full max-w-3xl mx-auto"
          >
            <form
              onSubmit={handleSearch}
              className="glass rounded-2xl p-1.5 sm:pr-0.5 flex flex-col sm:flex-row items-stretch gap-0"
              role="search"
              aria-label="Search visa destinations"
            >
              {/* Destination input */}
              <div className="flex-1 flex items-center gap-3 px-4 py-3">
                <MapPin size={18} className="text-cyan flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search destination..."
                  value={searchDestination}
                  onChange={(e) => setSearchDestination(e.target.value)}
                  className="flex-1 bg-transparent text-text-primary placeholder-text-muted text-sm focus:outline-none"
                  aria-label="Destination search"
                  id="hero-destination-input"
                />
              </div>

              <div className="hidden sm:block w-px h-8 bg-border self-center" aria-hidden="true" />

              {/* Travel date */}
              <div className="flex-1 flex items-center gap-3 px-4 py-3">
                <Calendar size={18} className="text-text-muted flex-shrink-0" />
                <input
                  type="date"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  className="flex-1 bg-transparent text-text-secondary text-sm focus:outline-none [color-scheme:dark]"
                  aria-label="Travel date"
                  id="hero-date-input"
                />
              </div>

              <div className="hidden sm:block w-px h-8 bg-border self-center" aria-hidden="true" />

              {/* Nationality */}
              <div className="flex-1 flex items-center gap-3 px-4 py-3">
                <Globe size={18} className="text-text-muted flex-shrink-0" />
                <select
                  value={searchNationality}
                  onChange={(e) => setSearchNationality(e.target.value)}
                  className="flex-1 bg-transparent text-text-secondary text-sm focus:outline-none appearance-none cursor-pointer [color-scheme:dark]"
                  aria-label="Nationality"
                  id="hero-nationality-input"
                >
                  {nationalitiesList.map((nat) => (
                    <option key={nat.value || 'placeholder'} value={nat.value} disabled={nat.value === ""} className="bg-background text-text-primary">
                      {nat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search button */}
              <Button
                type="submit"
                variant="primary"
                size="md"
                leftIcon={<Search size={16} />}
                className="w-full flex-shrink-0 sm:w-auto sm:self-stretch sm:px-5"
                id="hero-search-btn"
              >
                Search Visas
              </Button>
            </form>

            {searchTerm && (
              <div className="max-w-3xl mx-auto mt-4 text-left">
                <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
                  {suggestionMatches.length > 0 ? (
                    suggestionMatches.map((country) => (
                      <button
                        type="button"
                        key={country.id}
                        onClick={() => handleSuggestionSelect(country)}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm text-text-primary hover:bg-surface-2 transition-colors"
                      >
                        <span>{country.name}</span>
                        <span className="text-text-muted text-xs">{country.flagEmoji}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-text-muted">
                      No matching destinations found.
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>

          {/* Popular tags */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap justify-center gap-2 mt-6"
          >
            <span className="text-xs text-text-muted">Popular:</span>
            {["🇺🇸 USA", "🇬🇧 UK", "🇪🇺 Schengen", "🇦🇪 Dubai", "🇯🇵 Japan"].map((tag) => (
              <button
                key={tag}
                onClick={() => setSearchDestination(tag.split(" ")[1])}
                className="text-xs text-text-secondary hover:text-cyan px-2 py-1 rounded-md hover:bg-cyan/10 transition-colors"
              >
                {tag}
              </button>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          SECTION 2: STATS BAR
          ════════════════════════════════════════════════════ */}
      <section className="border-y border-border bg-surface/60 backdrop-blur-sm" aria-label="Key statistics">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map(({ value, label, icon: Icon }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col sm:flex-row items-center sm:items-start gap-3 text-center sm:text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan/10 flex items-center justify-center flex-shrink-0">
                  <Icon size={20} className="text-cyan" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-text-primary">{value}</div>
                  <div className="text-xs text-text-muted">{label}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          SECTION 3: TRENDING DESTINATIONS
          ════════════════════════════════════════════════════ */}
      <section id="destinations" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto">
        {/* Section header */}
        <motion.div {...fadeUp} className="text-center mb-12">
          <span className="text-xs font-semibold text-cyan uppercase tracking-widest mb-3 block">
            Trending Now
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Popular Destinations
          </h2>
          <p className="text-text-secondary max-w-xl mx-auto">
            Most-applied destinations this season. All visa requirements pre-verified by our experts.
          </p>
        </motion.div>

        {/* Destination cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredCountries.map((country, i) => (
            <motion.div
              ref={(el) => { countryCardRefs.current[country.id] = el; }}
              key={country.id}
              id={`country-card-${country.id}`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -6 }}
              className="group cursor-pointer"
              onClick={() => navigate(`/destination/${country.id}`)}
            >
              <div className="bg-surface border border-border rounded-2xl overflow-hidden hover:border-cyan/30 hover:shadow-cyan-glow transition-all duration-300">
                {/* Country header */}
                <div 
                  className="relative h-40 bg-cover bg-center"
                  style={{ backgroundImage: `url('${country.imageUrl || 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&q=80&w=800'}')` }}
                >
                  {/* Dark gradient overlay for text readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent opacity-90" />
                  
                  {/* Flag emoji */}
                  <div 
                    className="absolute bottom-3 left-4 text-3xl select-none drop-shadow-md" 
                    role="img" 
                    aria-label={country.name}
                  >
                    {country.flagEmoji}
                  </div>

                  {/* Price badge */}
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-gold/20 border border-gold/30 text-gold text-xs font-bold">
                    From ₹{country.basePrice}
                  </div>

                  {/* Success rate */}
                  <div className="absolute top-3 left-3">
                    <Badge variant={country.difficulty} size="sm">
                      {country.difficulty}
                    </Badge>
                  </div>
                </div>

                {/* Details */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-text-primary group-hover:text-cyan transition-colors">
                        {country.name}
                      </h3>
                      <p className="text-xs text-text-muted">{country.visaType}</p>
                    </div>
                  </div>

                  {/* Processing time */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <Clock size={12} className="text-cyan" />
                      {country.processingDays} days
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <TrendingUp size={12} className="text-emerald-400" />
                      {country.successRate}% approved
                    </div>
                  </div>

                  {/* Apply button */}
                  <button
                    id={`apply-btn-${country.id}`}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium bg-surface-2 text-text-secondary group-hover:bg-cyan group-hover:text-background transition-all duration-300"
                  >
                    Apply Now
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* View all link */}
        <motion.div {...fadeUp} className="text-center mt-10">
          <Button
            variant="secondary"
            rightIcon={<ArrowRight size={16} />}
            // Route visitors to the full public destinations page instead of the protected apply form.
            onClick={() => navigate("/destinations")}
            id="view-all-destinations-btn"
          >
            View All Destinations
          </Button>
        </motion.div>
      </section>

      {/* ════════════════════════════════════════════════════
          SECTION 4: HOW IT WORKS
          ════════════════════════════════════════════════════ */}
      <section
        id="how-it-works"
        className="py-20 bg-surface/40 border-y border-border"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div {...fadeUp} className="text-center mb-14">
            <span className="text-xs font-semibold text-cyan uppercase tracking-widest mb-3 block">
              Simple Process
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              We've simplified a complex process into three straightforward steps,
              so you can focus on your trip — not paperwork.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Connecting dashed line (desktop only) */}
            <div
              className="hidden md:block absolute top-[60px] left-[calc(16.67%+2rem)] right-[calc(16.67%+2rem)] h-px border-t border-dashed border-border"
              aria-hidden="true"
            />

            {HOW_IT_WORKS.map(({ step, icon: Icon, title, description, color, bg, border }, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative"
              >
                <div className={`bg-surface border ${border} rounded-2xl p-8 text-center hover:shadow-cyan-glow transition-all duration-300`}>
                  {/* Step number */}
                  <div className="text-7xl font-black text-border/60 absolute top-4 right-6 select-none">
                    {step}
                  </div>

                  {/* Icon */}
                  <div className={`w-16 h-16 rounded-2xl ${bg} border ${border} flex items-center justify-center mx-auto mb-6`}>
                    <Icon size={28} className={color} />
                  </div>

                  <h3 className="text-xl font-semibold text-text-primary mb-3">{title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          SECTION 5: TESTIMONIALS
          ════════════════════════════════════════════════════ */}
      <section className="py-20 px-4 sm:px-6 max-w-7xl mx-auto" aria-label="Customer testimonials">
        <motion.div {...fadeUp} className="text-center mb-14">
          <span className="text-xs font-semibold text-cyan uppercase tracking-widest mb-3 block">
            Real Stories
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            What Travelers Say
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="glass rounded-2xl p-6"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4" aria-label={`${t.rating} out of 5 stars`}>
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} size={14} className="text-gold fill-gold" />
                ))}
              </div>

              <p className="text-text-secondary text-sm leading-relaxed mb-6">
                "{t.text}"
              </p>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan/20 to-cyan/5 flex items-center justify-center border border-cyan/20">
                  <span className="text-cyan font-bold text-sm">
                    {t.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{t.name}</p>
                  <p className="text-xs text-text-muted">{t.role} · {t.country}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          SECTION 6: CTA BANNER
          ════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-20 px-4 sm:px-6">
        <motion.div
          {...fadeUp}
          className="max-w-4xl mx-auto rounded-3xl overflow-hidden relative"
        >
          {/* Gradient background */}
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(135deg, rgba(0,212,255,0.15) 0%, rgba(0,0,0,0) 50%, rgba(245,166,35,0.08) 100%)",
            }}
          />
          <div className="relative border border-cyan/20 rounded-3xl p-12 text-center">
            <div className="text-5xl mb-6">🌍</div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ready to Travel the World?
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto mb-8">
              Start your application today. Most visas approved in under 7 days.
              No hidden fees, no embassy queues.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button
                variant="primary"
                size="lg"
                rightIcon={<ArrowRight size={18} />}
                onClick={() => navigate("/apply")}
                id="cta-apply-btn"
              >
                Start Application
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => navigate("/login")}
                id="cta-login-btn"
              >
                Sign In to Dashboard
              </Button>
            </div>

            {/* Mini trust row */}
            <div className="flex flex-wrap justify-center gap-6 mt-8 text-sm text-text-muted">
              <span className="flex items-center gap-2"><Shield size={14} className="text-cyan" /> SSL Encrypted</span>
              <span className="flex items-center gap-2"><Users size={14} className="text-cyan" /> 50K+ Customers</span>
              <span className="flex items-center gap-2"><CheckCircle size={14} className="text-cyan" /> 98% Success Rate</span>
            </div>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
