import { useEffect } from "react";
import { SEO_DEFAULTS, APP_URL } from "@/lib/constants";

interface HeadProps {
  title?: string;
  description?: string;
  image?: string;
  canonical?: string;
}

export default function Head({ 
  title = SEO_DEFAULTS.title, 
  description = SEO_DEFAULTS.description, 
  image = SEO_DEFAULTS.ogImage,
  canonical
}: HeadProps) {
  useEffect(() => {
    // Update Document Title
    document.title = title;

    // Update Meta Tags
    const updateMeta = (name: string, content: string, attr: "name" | "property" = "name") => {
      let element = document.querySelector(`meta[${attr}="${name}"]`);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attr, name);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };

    updateMeta("description", description);
    updateMeta("og:title", title, "property");
    updateMeta("og:description", description, "property");
    updateMeta("og:image", image, "property");
    updateMeta("twitter:title", title);
    updateMeta("twitter:description", description);
    updateMeta("twitter:image", image);

    // Canonical Link
    const link = canonical || APP_URL + window.location.pathname;
    let canonicalElement = document.querySelector('link[rel="canonical"]');
    if (!canonicalElement) {
      canonicalElement = document.createElement("link");
      canonicalElement.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalElement);
    }
    canonicalElement.setAttribute("href", link);

  }, [title, description, image, canonical]);

  return null; // This component handles side effects only
}
