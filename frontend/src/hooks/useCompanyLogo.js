import { useState, useEffect } from 'react';
import api from '../services/api';
import { getBackendOrigin } from '../utils/backendOrigin.js';

const computeLogoUrl = (logo) => {
    if (!logo) return null;
    if (/^https?:\/\//i.test(logo)) return logo;
    const host = getBackendOrigin();
    return `${host.replace(/\/$/, "")}${logo.startsWith("/") ? "" : "/"}${logo}`;
};

export const useCompanyLogo = (fallback = "/sitemate-logo.svg") => {
    const [logoUrl, setLogoUrl] = useState(fallback);

    useEffect(() => {
        const fetchLogo = async () => {
            try {
                const userStr = localStorage.getItem("user");
                if (!userStr) return;
                
                const user = JSON.parse(userStr);
                let rawLogo = null;

                // 1. Try to get it from nested objects first
                if (user.clientId && typeof user.clientId === 'object' && user.clientId.logo) {
                    rawLogo = user.clientId.logo;
                } else if (user.companyLogo) {
                    rawLogo = user.companyLogo;
                } else if (user.logo) {
                    rawLogo = user.logo;
                } else if (user.client && user.client.logo) { // in case backend populated 'client' instead
                    rawLogo = user.client.logo;
                }
                
                // 2. If missing, load own organisation only (never list all clients)
                if (!rawLogo) {
                    try {
                        const res = await api.get("/auth/me");
                        const client = res.data?.user?.client;
                        if (client?.logo) {
                            rawLogo = client.logo;
                            user.client = client;
                            localStorage.setItem("user", JSON.stringify({ ...user, client }));
                        }
                    } catch (apiErr) {
                        console.error("Could not load company logo", apiErr);
                    }
                }
                
                if (rawLogo) {
                    const isSafetynett = (user.companyname || user.company || "").toString().trim().toLowerCase().replace(/\s+/g, "") === "safetynett";
                    if (isSafetynett) {
                        setLogoUrl("/sitemate-logo.svg");
                    } else {
                        setLogoUrl(computeLogoUrl(rawLogo));
                    }
                } else {
                    setLogoUrl(fallback);
                }
            } catch (e) {
                console.error("Error parsing user from localstorage for logo", e);
            }
        };
        
        fetchLogo();
    }, [fallback]);

    return logoUrl;
};
