import { api } from "../store/authStore";

export const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
  
export async function validateRazorpayCheckoutReadiness() {
  const loaded = await loadRazorpayScript();
  if (!loaded) {
    return { ok: false, message: "Could not load Razorpay checkout script." };
  }

  try {
    const configRes = await api.get("/config/razorpay");
    if (configRes.data?.success && configRes.data?.keyId) {
      return { ok: true, keyId: configRes.data.keyId };
    }
    return { ok: false, message: "Razorpay key is missing." };
  } catch (err) {
    return {
      ok: false,
      message:
        err?.response?.data?.message ||
        "Could not load Razorpay configuration.",
    };
  }
}

/**
 * Open Razorpay checkout for an existing application (order + verify on success).
 * @returns {Promise<{ success: boolean, dismissed?: boolean, data?: object }>}
 */
export async function openRazorpayForApplication({
  applicationId,
  amountRupees,
  description,
  applicantName,
  applicantEmail,
  onSuccess,
  onDismiss,
  onFailure,
}) {
  const loaded = await loadRazorpayScript();
  if (!loaded) {
    const message = "Could not load Razorpay checkout script.";
    onFailure?.(message);
    return { success: false, message };
  }

  let key = "";
  try {
    const configRes = await api.get("/config/razorpay");
    if (configRes.data?.success) key = configRes.data.keyId;
  } catch (err) {
    const message =
      err?.response?.data?.message ||
      "Could not load Razorpay configuration.";
    onFailure?.(message);
    return { success: false, message };
  }
  if (!key) {
    const message = "Razorpay key is missing.";
    onFailure?.(message);
    return { success: false, message };
  }

  let orderRes;
  try {
    orderRes = await api.post("/users/payments/create-order", {
      amount: amountRupees,
      applicationId,
    });
  } catch (err) {
    const message =
      err?.response?.data?.message || "Could not create Razorpay order.";
    onFailure?.(message);
    return { success: false, message };
  }

  if (!orderRes.data?.success || !orderRes.data?.order) {
    const message = orderRes.data?.message || "Razorpay order creation failed.";
    onFailure?.(message);
    return { success: false, message };
  }

  const order = orderRes.data.order;

  return new Promise((resolve) => {
    let settled = false;
    const settleOnce = () => {
      if (settled) return false;
      settled = true;
      return true;
    };

    const options = {
      key,
      amount: order.amount,
      currency: order.currency || "INR",
      name: "VISAANDVOYAGE",
      description: description || "Visa service payment",
      image: "/favicon.svg",
      order_id: order.id,
      handler: async (response) => {
        if (!settleOnce()) return;
        try {
          const verifyRes = await api.post("/users/payments/verify", {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            applicationId,
            amount: amountRupees,
          });
          if (verifyRes.data?.success) {
            onSuccess?.(verifyRes.data);
            resolve({ success: true, data: verifyRes.data });
            return;
          }
        } catch (e) {
          console.error(e);
        }
        try {
          await api.post("/users/payments/fail", {
            applicationId,
            reason: "Payment verification failed",
            razorpayOrderId: response?.razorpay_order_id || order.id,
            razorpayPaymentId: response?.razorpay_payment_id,
            source: "verify",
          });
        } catch {
          /* ignore */
        }
        const message = "Payment verification failed. Please contact support.";
        onFailure?.(message);
        resolve({ success: false, message });
      },
      prefill: {
        name: applicantName || "",
        email: applicantEmail || "",
      },
      theme: { color: "#00d4ff" },
      modal: {
        ondismiss: async () => {
          if (!settleOnce()) return;
          try {
            // Same endpoint as gateway failure so Razorpay cannot create two rows (failed + cancel).
            await api.post("/users/payments/fail", {
              applicationId,
              razorpayOrderId: order.id,
              reason: "User closed Razorpay checkout",
              source: "dismiss",
            });
          } catch {
            /* ignore */
          }
          onDismiss?.();
          resolve({ success: false, dismissed: true });
        },
      },
    };

    if (typeof window === "undefined" || typeof window.Razorpay !== "function") {
      const message = "Razorpay SDK is unavailable in this browser session.";
      onFailure?.(message);
      resolve({ success: false, message });
      return;
    }

    try {
      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", async (response) => {
        if (!settleOnce()) return;
        const failure = response?.error || {};
        const meta = failure.metadata || {};
        const razorpayOrderId =
          meta.order_id || failure.order_id || order.id;
        const razorpayPaymentId = meta.payment_id || failure.payment_id;
        const message =
          failure.description || "Razorpay reported a payment failure.";
        try {
          await api.post("/users/payments/fail", {
            applicationId,
            reason: message,
            razorpayOrderId,
            razorpayPaymentId,
            source: "gateway",
          });
        } catch {
          /* ignore */
        }
        onFailure?.(message);
        resolve({ success: false, message });
      });
      rzp.open();
    } catch (e) {
      const message = e?.message || "Unable to open Razorpay checkout.";
      onFailure?.(message);
      resolve({ success: false, message });
    }
  });
}
