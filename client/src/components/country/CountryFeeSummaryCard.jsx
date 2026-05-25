import {
  Landmark,
  Minus,
  Plus,
  ReceiptText,
  Rocket,
  Tag,
  UserRound,
} from "lucide-react";

const formatInr = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

const CountryFeeSummaryCard = ({
  travelerCount,
  onIncrementTraveler,
  onDecrementTraveler,
  governmentFeePerTraveler,
  serviceFeePerTraveler,
  gstEnabled = false,
  gstRate,
  governmentFeeTotal,
  gstPerTraveler,
  totalServiceFeePerTraveler,
  totalServiceFeeTotal,
  finalTotal,
  onStartApplication,
  startButtonId,
}) => {
  return (
    <section className="overflow-hidden rounded-[1.7rem] border border-white/65 bg-white shadow-[0_28px_80px_-46px_rgba(37,99,235,0.35)]">
      <div className="relative overflow-hidden bg-[linear-gradient(135deg,#0f3fa8_0%,#2563eb_48%,#38bdf8_100%)] px-4 pb-5 pt-4 text-white sm:px-5 sm:pb-6 sm:pt-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.20),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.12),transparent_28%)]" />
        <div className="absolute inset-y-0 left-[-12%] w-[44%] bg-[radial-gradient(circle_at_left,rgba(255,255,255,0.10),transparent_66%)]" />
        <div className="absolute -right-8 top-8 h-44 w-44 rounded-full border border-white/10" />
        <div className="absolute -right-2 top-16 h-32 w-32 rounded-full border border-white/10" />
        <div className="absolute left-4 top-1/2 hidden grid-cols-3 gap-2 opacity-35 sm:grid">
          {Array.from({ length: 9 }).map((_, index) => (
            <span key={`left-dot-${index}`} className="h-2 w-2 rounded-full bg-white/80" />
          ))}
        </div>
        <div className="absolute bottom-8 right-5 hidden grid-cols-3 gap-2 opacity-35 sm:grid">
          {Array.from({ length: 9 }).map((_, index) => (
            <span key={`right-dot-${index}`} className="h-2 w-2 rounded-full bg-white/80" />
          ))}
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/14 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.24)] backdrop-blur-sm sm:h-11 sm:w-11">
                <UserRound size={19} />
              </span>
              <div>
                <p className="text-base font-semibold tracking-tight text-white sm:text-lg">Travellers</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={onDecrementTraveler}
                disabled={travelerCount <= 1}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 bg-white/8 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-55 sm:h-11 sm:w-11"
                aria-label="Decrease travellers"
              >
                <Minus size={18} />
              </button>
              <span className="w-6 text-center text-base font-semibold text-white sm:text-lg">{travelerCount}</span>
              <button
                type="button"
                onClick={onIncrementTraveler}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 bg-white/8 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:bg-white/12 sm:h-11 sm:w-11"
                aria-label="Increase travellers"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          <div className="mt-6 text-center sm:mt-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/72 sm:text-xs">To Be Paid Now</p>
            <p className="mt-2.5 text-[2.25rem] font-extrabold tracking-tight text-white sm:text-[3rem]">{formatInr(finalTotal)}</p>
            <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-[11px] font-medium text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-sm sm:text-xs">
              <ReceiptText size={15} />
              <span>Total Amount</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3.5 bg-[linear-gradient(180deg,#ffffff_0%,#faf8ff_100%)] px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-[1.3rem] bg-white/80 px-1 py-1">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-blue-50 text-blue-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              <Landmark size={21} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold tracking-tight text-slate-950 sm:text-[1.15rem]">Government Fee</p>
              {travelerCount > 1 && (
                <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                  x{travelerCount}
                </p>
              )}
            </div>
            <span className="text-lg font-extrabold tracking-tight text-slate-950 sm:text-[1.5rem]">{formatInr(governmentFeeTotal)}</span>
          </div>

          <div className="h-px bg-slate-200" />

          <div className="group relative">
            <div
              tabIndex={0}
              className="flex w-full items-center gap-3 rounded-[1.3rem] bg-white/80 px-1 py-1 text-left outline-none"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-sky-50 text-blue-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <Tag size={21} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold tracking-tight text-slate-950 sm:text-[1.15rem]">Our Fee</p>
                {travelerCount > 1 && (
                  <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                    x{travelerCount}
                  </p>
                )}
              </div>
              <span className="text-lg font-extrabold tracking-tight text-slate-950 sm:text-[1.5rem]">
                {formatInr(totalServiceFeeTotal)}
              </span>
            </div>

            {gstEnabled && (
              <div className="pointer-events-none absolute right-0 top-full z-10 mt-2 w-72 rounded-[1.2rem] border border-blue-100 bg-white p-3.5 opacity-0 shadow-[0_18px_44px_-28px_rgba(37,99,235,0.35)] transition duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between gap-3 text-slate-600">
                    <span>
                      Our Service Fee
                      {travelerCount > 1 ? ` (${formatInr(serviceFeePerTraveler)} x ${travelerCount})` : ""}
                    </span>
                    <span className="font-semibold text-slate-950">
                      {formatInr(serviceFeePerTraveler * travelerCount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-slate-600">
                    <span>GST</span>
                    <span className="font-semibold text-slate-950">
                      {formatInr(gstPerTraveler * travelerCount)}
                    </span>
                  </div>
                  <div className="border-t border-slate-200 pt-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-900">Our Service + GST</span>
                      <span className="font-bold text-blue-600">{formatInr(totalServiceFeeTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[1.3rem] border border-blue-100 bg-[linear-gradient(180deg,#eff6ff_0%,#f8fbff_100%)] p-4 shadow-[0_20px_55px_-42px_rgba(37,99,235,0.25)]">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-[linear-gradient(180deg,#2563eb_0%,#0ea5e9_100%)] text-white shadow-[0_18px_30px_-22px_rgba(37,99,235,0.6)]">
              <ReceiptText size={21} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold tracking-tight text-slate-950 sm:text-[1.15rem]">Total Amount</p>
              <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">Government Fee + Our Fee</p>
            </div>
            <p className="text-xl font-extrabold tracking-tight text-blue-600 sm:text-[1.9rem]">
              {formatInr(finalTotal)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onStartApplication}
          id={startButtonId}
          className="group flex w-full items-center justify-center gap-3 rounded-[1.3rem] bg-[linear-gradient(90deg,#2563eb_0%,#1d4ed8_45%,#0ea5e9_100%)] px-5 py-4 text-white shadow-[0_22px_40px_-24px_rgba(37,99,235,0.7)] transition-transform duration-200 hover:-translate-y-0.5"
        >
          <span className="flex items-center gap-3 text-left">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
              <Rocket size={18} />
            </span>
            <span className="text-base font-semibold tracking-tight sm:text-lg">Start Your Application</span>
          </span>
        </button>
      </div>
    </section>
  );
};

export default CountryFeeSummaryCard;
