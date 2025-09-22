// src/usePageMeta.js
import { useEffect } from 'react';

export function usePageMeta({ title, description, robots, canonical } = {}) {
  useEffect(() => {
    if (title) {
      document.title = title;
    }

    if (description !== undefined) {
      let tag = document.querySelector('meta[name="description"]');
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', 'description');
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', description || '');
    }

    if (robots !== undefined) {
      let tag = document.querySelector('meta[name="robots"]');
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', 'robots');
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', robots || '');
    }

    if (canonical !== undefined) {
      let link = document.querySelector("link[rel='canonical']");
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', canonical || '');
    }
  }, [title, description, robots, canonical]);
}