import { motion } from "framer-motion";
import Card from "../../components/ui/Card";

const PaymentsPage = ({ transactions }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
    <Card>
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-semibold text-text-primary">Payment Transactions</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/50 text-sm text-text-muted">
              <th className="py-3 px-4 font-medium">Date</th>
              <th className="py-3 px-4 font-medium">User</th>
              <th className="py-3 px-4 font-medium">Payment ID</th>
              <th className="py-3 px-4 font-medium">Amount</th>
              <th className="py-3 px-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-8 text-center text-text-muted">No transactions found.</td>
              </tr>
            ) : (
              transactions.map((transaction) => (
                <tr key={transaction._id} className="border-b border-border/30 hover:bg-surface-2 transition-colors">
                  <td className="py-3 px-4 text-text-secondary">
                    {new Date(transaction.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-text-primary font-medium">
                    {transaction.user?.name || "Unknown"}
                    <div className="text-xs text-text-muted font-normal">{transaction.user?.email || ""}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-text-secondary">
                    {transaction.razorpayPaymentId || transaction.paymentId || transaction.razorpayOrderId || "N/A"}
                  </td>
                  <td className="py-3 px-4 font-medium text-text-primary">
                    ₹{Number(transaction.amount || 0).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${transaction.status === "success" ? "bg-emerald-500/10 text-emerald-400" : transaction.status === "failed" ? "bg-red-500/10 text-red-400" : transaction.status === "cancelled" ? "bg-slate-500/10 text-slate-300" : "bg-amber-500/10 text-amber-400"}`}>
                      {String(transaction.status || "pending").charAt(0).toUpperCase() + String(transaction.status || "pending").slice(1)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  </motion.div>
);

export default PaymentsPage;
