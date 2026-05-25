import {
  BadgeCheck,
  CalendarDays,
  Clock3,
  DoorOpen,
  Globe2,
  Info,
  MapPin,
  Plane,
  ShieldCheck,
  SquarePen,
} from "lucide-react";

const ITEM_ICON_MAP = {
  calendar: CalendarDays,
  clock: Clock3,
  clock3: Clock3,
  door: DoorOpen,
  "door-open": DoorOpen,
};

const COLOR_MAP = {
  blue: {
    badge: "bg-blue-50 text-blue-600 ring-blue-100",
    iconWrap: "bg-blue-50 text-blue-600 ring-blue-100",
    value: "text-blue-600",
    accent: "bg-blue-500",
    note: "bg-blue-50/80 text-blue-700 ring-blue-100",
    card: "border-blue-100/80 hover:border-blue-200",
  },
  green: {
    badge: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    iconWrap: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    value: "text-emerald-600",
    accent: "bg-emerald-500",
    note: "bg-emerald-50/80 text-emerald-700 ring-emerald-100",
    card: "border-emerald-100/80 hover:border-emerald-200",
  },
  purple: {
    badge: "bg-violet-50 text-violet-600 ring-violet-100",
    iconWrap: "bg-violet-50 text-violet-600 ring-violet-100",
    value: "text-violet-600",
    accent: "bg-violet-500",
    note: "bg-violet-50/80 text-violet-700 ring-violet-100",
    card: "border-violet-100/80 hover:border-violet-200",
  },
};

const splitTitle = (title) => {
  const text = String(title ?? "").trim();
  if (!text) return { leading: "Visa", accent: "Information" };
  const words = text.split(/\s+/);
  if (words.length === 1) return { leading: words[0], accent: "" };
  return {
    leading: words.slice(0, -1).join(" "),
    accent: words[words.length - 1],
  };
};

const getItemStyles = (color) => COLOR_MAP[color] || COLOR_MAP.blue;

const LEGACY_DISPLAY_BY_ITEM_ID = {
  lengthOfStay: "showLengthOfStay",
  validity: "showValidity",
  entry: "showEntryType",
};

const VisaInformationSection = ({ visaInformation, display }) => {
  const section = visaInformation && typeof visaInformation === "object" ? visaInformation : null;
  const items = Array.isArray(section?.items)
    ? section.items.filter((item) => {
        if (item?.enabled === false) return false;
        const legacyDisplayKey = LEGACY_DISPLAY_BY_ITEM_ID[item?.id];
        if (!legacyDisplayKey) return true;
        return display?.[legacyDisplayKey] !== false;
      })
    : [];

  if (!section?.enabled || items.length === 0) return null;

  const titleParts = splitTitle(section.title);

  return (
    <section className="relative mr-auto max-w-[47.5rem] overflow-hidden rounded-[1.7rem] border border-[#dbe8ff] bg-white px-4 py-7 shadow-[0_20px_60px_rgba(37,99,235,0.08)] sm:px-6 sm:py-8 lg:max-w-[49.5rem] lg:px-7 lg:py-10 xl:max-w-[51rem]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.09),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(147,197,253,0.12),transparent_30%)]" />
      <div className="pointer-events-none absolute -left-10 top-16 h-40 w-40 rounded-full bg-blue-50 blur-3xl" />
      <div className="pointer-events-none absolute -right-12 top-10 hidden h-56 w-56 rounded-full bg-sky-50 blur-3xl md:block" />
      <Globe2 className="pointer-events-none absolute right-6 top-14 hidden h-40 w-40 text-blue-100 md:block" strokeWidth={1.2} />
      <Plane className="pointer-events-none absolute right-8 top-10 h-8 w-8 text-blue-500" strokeWidth={2} />
      <div className="pointer-events-none absolute right-20 top-20 hidden h-28 w-56 rounded-full border border-dashed border-blue-200 md:block" style={{ borderLeftColor: "transparent", borderBottomColor: "transparent" }} />
      <MapPin className="pointer-events-none absolute right-[18rem] top-36 hidden h-5 w-5 text-blue-400 md:block" strokeWidth={2} />

      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-600 ring-1 ring-blue-100">
          <BadgeCheck size={16} />
          <span>{section.badgeText || "100% Online Process"}</span>
        </div>

        <div className="mt-4 max-w-3xl">
          <h2 className="text-[2.15rem] font-bold tracking-tight text-slate-900 sm:text-[2.5rem] lg:text-[3.05rem] lg:leading-[1.08]">
            <span>{titleParts.leading}</span>
            {titleParts.accent ? (
              <>
                {" "}
                <span className="bg-gradient-to-r from-blue-500 to-sky-400 bg-clip-text text-transparent">
                  {titleParts.accent}
                </span>
              </>
            ) : null}
          </h2>
          <p className="mt-2.5 max-w-2xl text-sm leading-6 text-slate-600 sm:text-[15px]">
            {section.subtitle}
          </p>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => {
            const Icon = ITEM_ICON_MAP[item.icon] || CalendarDays;
            const styles = getItemStyles(item.color);
            return (
              <article
                key={item.id || index}
                className={`group relative overflow-hidden rounded-[1.35rem] border bg-white p-5 pb-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(37,99,235,0.12)] ${styles.card}`}
              >
                <div className="pointer-events-none absolute inset-x-6 bottom-0 h-24 rounded-t-[2rem] bg-gradient-to-t from-blue-50/50 to-transparent opacity-70" />
                <div className="relative flex items-start justify-between gap-4">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-[1rem] ring-1 ${styles.iconWrap}`}>
                    <Icon size={21} strokeWidth={1.9} />
                  </div>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ring-1 ${styles.badge}`}>
                    {String(index + 1).padStart(2, "0")}
                  </div>
                </div>
                <div className="relative mt-5 pb-3">
                  <h3 className="text-[1.12rem] font-bold tracking-tight text-slate-900 sm:text-[1.2rem]">{item.label}</h3>
                  <div className={`mt-2.5 h-1 w-10 rounded-full ${styles.accent}`} />
                  <p className={`mt-3 text-[1.35rem] font-semibold tracking-tight sm:text-[1.58rem] ${styles.value}`}>
                    {item.value || "On request"}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        

        
      </div>
    </section>
  );
};

export default VisaInformationSection;
