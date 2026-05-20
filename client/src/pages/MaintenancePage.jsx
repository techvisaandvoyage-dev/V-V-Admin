import { motion } from "framer-motion";
import {
  Bug,
  Cog,
  MonitorSmartphone,
  ShieldAlert,
  Sparkles,
  Wrench,
} from "lucide-react";

const FloatingChip = ({ className = "", children }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45 }}
    className={className}
  >
    {children}
  </motion.div>
);

const MaintenancePage = () => {
  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.14),_transparent_26%),linear-gradient(180deg,_#f8fbff_0%,_#eef5ff_100%)]">
      <div className="mx-auto flex min-h-screen max-w-7xl items-center px-6 py-12 sm:px-10 lg:px-12">
        <div className="grid w-full items-center gap-12 lg:grid-cols-[minmax(0,1.02fr)_minmax(420px,0.98fr)]">
          <motion.div
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55 }}
            className="max-w-2xl"
          >
            <div className="inline-flex items-center gap-3 rounded-full border border-cyan/20 bg-white/80 px-4 py-2 text-sm font-semibold text-cyan shadow-[0_18px_40px_-28px_rgba(6,182,212,0.4)] backdrop-blur">
              <Cog size={16} className="animate-spin [animation-duration:4s]" />
              We&apos;re Working on It!
            </div>

            <h1 className="mt-8 text-5xl font-black tracking-tight text-slate-950 sm:text-6xl lg:text-[4.75rem] lg:leading-[0.98]">
              Fixing Some Bugs
            </h1>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-cyan sm:text-4xl">
              We&apos;ll Be Back Soon!
            </h2>

            <p className="mt-8 max-w-xl text-lg leading-9 text-slate-600 sm:text-[1.35rem]">
              Our team is squashing some pesky bugs to improve your experience.
              Thanks for your patience while we tune things up.
            </p>

            <div className="mt-10 max-w-md rounded-[1.8rem] border border-cyan/20 bg-white/80 p-5 shadow-[0_24px_60px_-32px_rgba(37,99,235,0.22)] backdrop-blur">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan/10 text-cyan">
                  <ShieldAlert size={26} />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900">System Status</p>
                  <p className="mt-1 text-base font-semibold text-cyan">
                    Maintenance in progress
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-7 flex items-center gap-3 text-base text-slate-500">
              <Sparkles size={18} className="text-cyan" />
              We&apos;ll be back shortly.
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 18, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="relative mx-auto w-full max-w-[680px]"
          >
            <div className="absolute -left-2 top-8 hidden rounded-full bg-white/70 p-4 text-cyan shadow-lg backdrop-blur sm:block">
              <Sparkles size={24} />
            </div>
            <div className="absolute right-6 top-10 hidden rounded-full bg-white/70 p-4 text-slate-300 shadow-lg backdrop-blur md:block">
              <Cog size={28} className="animate-spin [animation-duration:10s]" />
            </div>
            <div className="absolute -right-2 top-1/3 hidden rounded-full bg-white/60 p-6 text-slate-200 shadow-lg backdrop-blur lg:block">
              <Cog size={52} className="animate-spin [animation-duration:14s]" />
            </div>

            <div className="relative rounded-[2.6rem] border border-white/70 bg-white/35 p-5 shadow-[0_40px_90px_-44px_rgba(37,99,235,0.35)] backdrop-blur-xl sm:p-8">
              <div className="relative mx-auto aspect-[1.15/0.9] max-w-[640px]">
                <div className="absolute left-[12%] top-[13%] h-[52%] w-[63%] rounded-[2rem] border border-slate-900/70 bg-[linear-gradient(180deg,_#17366d_0%,_#0e2247_100%)] shadow-[0_30px_60px_-30px_rgba(15,23,42,0.55)]">
                  <div className="absolute inset-x-[7%] top-[8%] h-4 rounded-full bg-white/12" />
                  <div className="absolute inset-x-[11%] top-[20%] h-3 rounded-full bg-white/10" />
                  <div className="absolute left-[11%] top-[29%] h-3 w-[55%] rounded-full bg-white/10" />
                  <div className="absolute left-[11%] top-[39%] h-3 w-[44%] rounded-full bg-white/10" />
                  <div className="absolute left-[11%] top-[49%] h-3 w-[58%] rounded-full bg-white/10" />
                  <div className="absolute left-[11%] top-[59%] h-3 w-[38%] rounded-full bg-white/10" />
                </div>

                <div className="absolute left-[19%] top-[58%] h-[8%] w-[50%] rounded-b-[2.2rem] bg-slate-300 shadow-inner" />
                <div className="absolute left-[4%] top-[62%] h-[14%] w-[78%] rounded-[1.6rem] bg-[linear-gradient(180deg,_#d9dee8_0%,_#aab7c9_100%)] shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)]" />

                <motion.div
                  animate={{ y: [0, -5, 0], rotate: [0, -1.5, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute left-[31%] top-[31%] z-10 rounded-[1.8rem] border-[7px] border-amber-400 bg-white px-7 py-5 shadow-[0_25px_55px_-24px_rgba(245,158,11,0.55)]"
                  style={{
                    boxShadow:
                      "0 25px 55px -24px rgba(245,158,11,0.55), inset 0 0 0 10px rgba(17,24,39,0.9)",
                  }}
                >
                  <div className="space-y-1.5 text-center font-black uppercase leading-none text-slate-950">
                    <p className="text-3xl">Under</p>
                    <p className="text-3xl">Maintenance</p>
                  </div>
                </motion.div>

                <FloatingChip className="absolute left-[11%] top-[71%]">
                  <div className="flex items-center gap-3 rounded-[1.5rem] bg-white px-4 py-3 shadow-[0_24px_45px_-28px_rgba(15,23,42,0.45)]">
                    <div className="rounded-2xl bg-orange-500/10 p-3 text-orange-500">
                      <Bug size={28} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Fixing bugs</p>
                      <p className="text-xs text-slate-500">Release patch underway</p>
                    </div>
                  </div>
                </FloatingChip>

                <FloatingChip className="absolute right-[3%] top-[66%]">
                  <div className="flex items-center gap-3 rounded-[1.5rem] bg-white px-4 py-3 shadow-[0_24px_45px_-28px_rgba(15,23,42,0.45)]">
                    <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-500">
                      <Wrench size={28} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Bug fixed</p>
                      <p className="text-xs text-slate-500">System check running</p>
                    </div>
                  </div>
                </FloatingChip>

                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute left-[56%] top-[1%] z-20"
                >
                  <div className="rounded-[1.7rem] border border-lime-400/40 bg-white/90 p-3 shadow-[0_28px_55px_-28px_rgba(101,163,13,0.45)]">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-lime-500/15 p-3 text-lime-600">
                        <Bug size={30} />
                      </div>
                      <div className="hidden sm:block">
                        <p className="text-sm font-bold text-slate-900">Patch team online</p>
                        <p className="text-xs text-slate-500">Deploying safe fixes</p>
                      </div>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  animate={{ x: [0, 6, 0], y: [0, -3, 0] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute bottom-[12%] right-[12%] rounded-full bg-white p-4 text-cyan shadow-[0_22px_42px_-25px_rgba(37,99,235,0.38)]"
                >
                  <MonitorSmartphone size={28} />
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
