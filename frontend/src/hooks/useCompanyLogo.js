import { useState, useEffect } from 'react';
import api from '../services/api';

const computeLogoUrl = (logo) => {
    if (!logo) return null;
    if (/^https?:\/\//i.test(logo)) return logo;
    const host = import.meta.env.VITE_BACKEND_URL || "https://api.site-mateai.co.uk";
    return `${host.replace(/\/$/, "")}${logo.startsWith("/") ? "" : "/"}${logo}`;
};

export const useCompanyLogo = (fallback = "/logo2.png") => {
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
                
                // 2. If missing, look up by clientId or companyname via API
                if (!rawLogo) {
                    try {
                        // fetch all clients to find the related logo
                        const res = await api.get('/clients');
                        if (res.data?.success) {
                            const clients = res.data.data || [];
                            let clientMatch = null;
                            
                            if (user.clientId && typeof user.clientId === 'string') {
                                clientMatch = clients.find(c => c.id === user.clientId);
                            }
                            
                            if (!clientMatch && user.companyname) {
                                clientMatch = clients.find(c => c.name.toLowerCase() === user.companyname.toLowerCase());
                            }
                            
                            if (clientMatch && clientMatch.logo) {
                                rawLogo = clientMatch.logo;
                                // Cache it back in user object to avoid subsequent API calls (optional but handy)
                                user.client = { ...clientMatch };
                                localStorage.setItem("user", JSON.stringify(user));
                            }
                        }
                    } catch (apiErr) {
                        console.error("Could not fetch clients for logo", apiErr);
                    }
                }
                
                if (rawLogo) {
                    // Force logo2.png for Safetynett users
                    const isSafetynett = (user.companyname || user.company || "").toString().trim().toLowerCase().replace(/\s+/g, "") === "safetynett";
                    if (isSafetynett) {
                        setLogoUrl("/logo2.png");
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
