import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, Clock, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { useDataStore } from "../store/dataStore";

// Reuse the same scroll-in animation style to keep page transitions consistent.
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.5, ease: "easeOut" },
};

const AllDestinationsPage = () => {
  const navigate = useNavigate();
  // Pull destinations from the shared store so this page reflects admin edits too.
  const countries = useDataStore((state) => state.countries);

  // Always open this listing from the top when users arrive from the landing page CTA.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  // Prefer browser history for back navigation, but always provide a safe fallback.
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero copy introduces the dedicated destinations listing page. */}
        <section className="border-b border-border bg-surface/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ArrowLeft size={16} />}
              onClick={handleBack}
              className="mb-6 w-fit"
              id="all-destinations-back-btn"
            >
              Back
            </Button>

            <motion.div {...fadeUp} className="max-w-3xl">
              <span className="text-xs font-semibold text-cyan uppercase tracking-widest mb-3 block">
                Explore More
              </span>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-text-primary mb-4">
                All Destinations
              </h1>
              <p className="text-text-secondary text-base sm:text-lg leading-relaxed">
                Browse every available visa destination in one place and open any country
                page to review pricing, processing time, and application details.
              </p>
            </motion.div>
          </div>
        </section>

        {/* The card grid mirrors the landing page so the experience feels familiar. */}
        <section className="py-10 sm:py-14 px-4 sm:px-6 max-w-7xl mx-auto w-full">
          <motion.div
            {...fadeUp}
            className="flex items-center justify-between gap-4 flex-wrap mb-8"
          >
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-text-primary">
                Available Countries
              </h2>
              <p className="text-text-secondary mt-2">
                {countries.length} destinations ready to explore
              </p>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {countries.map((country, index) => (
              <motion.div
                key={country.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ y: -6 }}
                className="group cursor-pointer"
                onClick={() => navigate(`/destination/${country.id}`)}
              >
                <div className="bg-surface border border-border rounded-2xl overflow-hidden hover:border-cyan/30 hover:shadow-cyan-glow transition-all duration-300">
                  <div
                    className="relative h-40 bg-cover bg-center"
                    style={{
                      backgroundImage: `url('${country.imageUrl || "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&q=80&w=800"}')`,
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent opacity-90" />

                    <div
                      className="absolute bottom-3 left-4 text-3xl select-none drop-shadow-md"
                      role="img"
                      aria-label={country.name}
                    >
                      {country.flagEmoji}
                    </div>

                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-gold/20 border border-gold/30 text-gold text-xs font-bold">
                      From ₹{country.basePrice}
                    </div>

                    <div className="absolute top-3 left-3">
                      <Badge variant={country.difficulty} size="sm">
                        {country.difficulty}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-text-primary group-hover:text-cyan transition-colors">
                          {country.name}
                        </h3>
                        <p className="text-xs text-text-muted">{country.visaType}</p>
                      </div>
                    </div>

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

                    <button
                      type="button"
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium bg-surface-2 text-text-secondary group-hover:bg-cyan group-hover:text-background transition-all duration-300"
                    >
                      View Destination
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default AllDestinationsPage;
