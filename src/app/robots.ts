import { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
    // sitemap: `${siteConfig.url}/sitemap.xml`, // No sitemap for private system
  };
}
