
// ============================================================
//  StepIndicator Component
//  Shows multi-step progress for the Application Form.
//  Displays step labels, numbered circles, and connecting lines.
// ============================================================
import { Check } from "lucide-react";
import { motion } from "framer-motion";

/**
 * @param {string[]} steps       — Array of step labels
 * @param {number}   currentStep — 0-based current step index
 */
const StepIndicator = ({ steps, currentStep }) => {
  return (
    <div className="w-full" aria-label="Application progress">
      {/* ── Desktop step indicator ─── */}
      <div className="flex items-center w-full">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive    = index === currentStep;
          const isUpcoming  = index > currentStep;

          return (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              {/* Step circle */}
              <div className="flex flex-col items-center gap-2">
                <motion.div
                  initial={false}
                  animate={{
                    scale: isActive ? 1.1 : 1,
                  }}
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    font-semibold text-sm transition-all duration-300 border-2
                    ${isCompleted
                      ? "bg-cyan border-cyan text-background"
                      : isActive
                      ? "bg-transparent border-cyan text-cyan shadow-cyan-glow"
                      : "bg-surface-2 border-border text-text-muted"
                    }
                  `}
                >
                  {isCompleted ? (
                    <Check size={16} strokeWidth={3} />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </motion.div>

                {/* Step label */}
                <span
                  className={`
                    text-xs font-medium whitespace-nowrap hidden sm:block
                    ${isActive ? "text-cyan" : isCompleted ? "text-text-primary" : "text-text-muted"}
                  `}
                >
                  {step}
                </span>
              </div>

              {/* Connecting line between steps (not after last) */}
              {index < steps.length - 1 && (
                <div className="flex-1 mx-3 mb-6">
                  <div className="h-px bg-border relative overflow-hidden">
                    <motion.div
                      initial={{ width: "0%" }}
                      animate={{ width: isCompleted ? "100%" : "0%" }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                      className="absolute inset-0 bg-cyan"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Mobile: show current step text ─── */}
      <p className="sm:hidden text-center text-sm text-text-secondary mt-3">
        Step{" "}
        <span className="text-cyan font-semibold">{currentStep + 1}</span>
        {" "}of{" "}
        <span className="font-semibold">{steps.length}</span>
        {" — "}
        <span className="text-text-primary">{steps[currentStep]}</span>
      </p>
    </div>
  );
};

export default StepIndicator;
