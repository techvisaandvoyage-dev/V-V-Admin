import { memo } from "react";
import { ArrowRight } from "lucide-react";
import Button from "../ui/Button";
import DestinationCard from "../country/DestinationCard";
import { getCountryRouteId } from "../../utils/countryRouting";

const LandingCountriesGrid = memo(
  function LandingCountriesGrid({
    countryIdsKey,
    filteredCountries,
    countryCardRefs,
    display,
    documentCatalog,
    showVisaRequirements = true,
    onNavigateDestination,
    onNavigateAll,
  }) {
    return (
      <section id="destinations" className="pt-8 pb-16 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold">Countries</h2>
          <Button
            variant="secondary"
            rightIcon={<ArrowRight size={16} />}
            onClick={onNavigateAll}
            id="view-all-destinations-btn"
          >
            View All Countries
          </Button>
        </div>

        <div key={countryIdsKey} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredCountries.map((country, i) => (
            <DestinationCard
              key={getCountryRouteId(country)}
              id={`country-card-${getCountryRouteId(country)}`}
              cardRef={(el) => {
                countryCardRefs.current[getCountryRouteId(country)] = el;
              }}
              country={country}
              index={i}
              display={display}
              documentCatalog={documentCatalog}
              showVisaRequirements={showVisaRequirements}
              onClick={() => onNavigateDestination(country)}
            />
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Button
            variant="primary"
            rightIcon={<ArrowRight size={16} />}
            onClick={onNavigateAll}
            id="explore-more-countries-btn"
            className="min-w-[220px]"
          >
            Explore More Countries
          </Button>
        </div>
      </section>
    );
  },
  (prev, next) =>
    prev.countryIdsKey === next.countryIdsKey &&
    prev.display === next.display &&
    prev.documentCatalog === next.documentCatalog &&
    prev.showVisaRequirements === next.showVisaRequirements
);

export default LandingCountriesGrid;
