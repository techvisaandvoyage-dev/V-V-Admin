// ============================================================
//  OtpInput — 6-box OTP input with auto-advance, paste & backspace
// ============================================================
import { useRef, useEffect } from "react";
import { motion } from "framer-motion";

const OtpInput = ({ value = "", onChange, disabled = false }) => {
  const inputsRef = useRef([]);
  const digits = Array.isArray(value)
    ? [...value, ...Array(6).fill("")].slice(0, 6)
    : String(value).padEnd(6, "").split("").slice(0, 6);

  // Focus the first empty box on mount
  useEffect(() => {
    const firstEmpty = digits.findIndex((d) => d === " " || d === "");
    const idx = firstEmpty === -1 ? 5 : firstEmpty;
    inputsRef.current[Math.min(idx, 5)]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e, index) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) return;
    const char = raw[raw.length - 1]; // take last char in case of paste-into-box

    const next = digits.map((d, i) => (i === index ? char : d));
    onChange(next);

    // Advance focus
    if (index < 5) {
      e.target.nextSibling?.focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace") {
      if (digits[index] && digits[index] !== " ") {
        // Clear current
        const next = digits.map((d, i) => (i === index ? "" : d));
        onChange(next);
      } else if (index > 0) {
        // Move back
        inputsRef.current[index - 1]?.focus();
        const next = digits.map((d, i) => (i === index - 1 ? "" : d));
        onChange(next);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      const nextDigits = pasted.padEnd(6, "").split("").slice(0, 6);
      onChange(nextDigits);
      const nextFocus = Math.min(pasted.length, 5);
      inputsRef.current[nextFocus]?.focus();
    }
  };

  return (
    <div className="flex gap-3 justify-center">
      {Array.from({ length: 6 }).map((_, i) => {
        const char = digits[i] && digits[i] !== " " ? digits[i] : "";
        const isFilled = !!char;
        return (
          <motion.input
            key={i}
            ref={(el) => (inputsRef.current[i] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={char}
            disabled={disabled}
            onChange={(e) => handleChange(e, i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}
            className={`
              w-11 h-14 text-center text-xl font-bold font-mono rounded-xl border-2 outline-none
              bg-background transition-all duration-200 cursor-text
              ${isFilled
                ? "border-cyan text-text-primary shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                : "border-border text-text-primary focus:border-cyan focus:shadow-[0_0_12px_rgba(6,182,212,0.2)]"
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          />
        );
      })}
    </div>
  );
};

export default OtpInput;
