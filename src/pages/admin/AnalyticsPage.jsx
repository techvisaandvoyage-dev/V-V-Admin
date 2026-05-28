import { motion } from "framer-motion";
import { TrendingUp, Clock, FileText, IndianRupee } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import Card from "../../components/ui/Card";
import { MONTHLY_REVENUE } from "../../data/bookings";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-3 shadow-modal">
      <p className="text-xs font-semibold text-text-primary mb-2">{label}</p>
      {payload.map((point) => (
        <p key={point.dataKey} className="text-xs" style={{ color: point.color }}>
          {point.name}: {point.dataKey === "revenue" ? `₹${point.value}` : point.value}
        </p>
      ))}
    </div>
  );
};

const AnalyticsPage = ({ activeChart, setActiveChart, liveAnalytics }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { label: "Total Bookings", value: liveAnalytics.total, icon: FileText, color: "text-cyan", bg: "bg-cyan/10", suffix: "" },
        { label: "Total Revenue", value: `₹${liveAnalytics.revenue}`, icon: IndianRupee, color: "text-gold", bg: "bg-gold/10", suffix: "" },
        { label: "Pending Review", value: liveAnalytics.pending, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10", suffix: "" },
        { label: "Approval Rate", value: liveAnalytics.approvalRate, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10", suffix: "%" },
      ].map(({ label, value, icon: Icon, color, bg, suffix }, index) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.08 }}
        >
          <Card className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
              <Icon size={22} className={color} />
            </div>
            <div>
              <div className="text-2xl font-bold text-text-primary">
                {value}
                {suffix}
              </div>
              <div className="text-xs text-text-muted">{label}</div>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>

    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="font-semibold text-text-primary">Monthly Overview</h2>
        <div className="flex p-1 bg-surface-2 rounded-xl">
          {[
            { id: "revenue", label: "Revenue" },
            { id: "bookings", label: "Bookings" },
          ].map(({ id, label }) => (
            <button
              key={id}
              id={`chart-toggle-${id}`}
              onClick={() => setActiveChart(id)}
              className={`relative px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${activeChart === id ? "text-background" : "text-text-muted hover:text-text-primary"}`}
            >
              {activeChart === id && (
                <motion.div
                  layoutId="chartTogglePill"
                  className="absolute inset-0 bg-cyan rounded-lg"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {activeChart === "revenue" ? (
            <LineChart data={MONTHLY_REVENUE}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => `₹${value}`} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#0284c7", strokeWidth: 1, strokeDasharray: "4 4" }} />
              <Line
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="#0284c7"
                strokeWidth={3}
                dot={{ fill: "#ffffff", stroke: "#0284c7", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: "#0284c7", stroke: "#ffffff", strokeWidth: 2 }}
                isAnimationActive
                animationDuration={1500}
                animationEasing="ease-in-out"
              />
            </LineChart>
          ) : (
            <BarChart data={MONTHLY_REVENUE}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#e5e7eb", opacity: 0.6 }} />
              <Bar
                dataKey="bookings"
                name="Bookings"
                fill="#0284c7"
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={1500}
                animationEasing="ease-in-out"
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </Card>

    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {[
        { label: "Approved", count: liveAnalytics.statusCounts.approved, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
        { label: "Under Review", count: liveAnalytics.statusCounts.review, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
        { label: "Pending", count: liveAnalytics.statusCounts.pending, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
        { label: "Rejected", count: liveAnalytics.statusCounts.rejected, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
      ].map(({ label, count, color, bg, border }) => (
        <div key={label} className={`${bg} border ${border} rounded-xl p-4 text-center`}>
          <div className={`text-3xl font-bold ${color}`}>{count}</div>
          <div className="text-xs text-text-muted mt-1">{label}</div>
        </div>
      ))}
    </div>
  </motion.div>
);

export default AnalyticsPage;
