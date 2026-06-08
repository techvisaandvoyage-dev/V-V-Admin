import { useEffect, useState } from "react";
import { api, SERVER_URL } from "../store/authStore";

const DEFAULT_SITE_LOGO = "/images/visa-voyage-logo.webp";

let cachedSiteLogo = "";

const resolveLogoUrl = (value) => {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^(?:https?:\/\/|data:|blob:)/i.test(url)) return url;
  if (url.startsWith("/")) return `${SERVER_URL}${url}`;
  return `${SERVER_URL}/${url}`;
};

export const useSiteLogo = () => {
  const [siteLogo, setSiteLogo] = useState(cachedSiteLogo || DEFAULT_SITE_LOGO);

  useEffect(() => {
    let active = true;

    const loadSiteLogo = async () => {
      try {
        const { data } = await api.get("/config/footer");
        if (!active) return;
        const nextLogo = resolveLogoUrl(data?.config?.logo) || DEFAULT_SITE_LOGO;
        cachedSiteLogo = nextLogo;
        setSiteLogo(nextLogo);
      } catch {
        if (!active) return;
        setSiteLogo(cachedSiteLogo || DEFAULT_SITE_LOGO);
      }
    };

    loadSiteLogo();
    return () => {
      active = false;
    };
  }, []);

  return siteLogo || DEFAULT_SITE_LOGO;
};
