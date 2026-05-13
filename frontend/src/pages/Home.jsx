import TrendingProducts from '../components/catalog/TrendingProducts';
import HeroSection from '../components/ui/HeroSection';
import tapeTechLogo from '/brands/TapeTech/tapetech_logo.svg';
import columbiaLogo from '/brands/Columbia/columbia_logo_white.svg';
import surproLogo from '/brands/SurPro/surpro_logo.svg';
import asgardLogo from '/brands/Asgard/asgard_logo.svg';
import platinumLogo from '/brands/Platinum/platinum_logo_white.svg';
import level5Logo from '/brands/Level5/Level5.svg';
import SEOHead from '../components/shared/SEOHead';
import { buildOrganizationSchema, buildSiteLinksSearchBoxSchema } from '../utils/schema';

const brandLogos = [
  { name: 'TapeTech', src: tapeTechLogo, to: '/products?brand=tapetech' },
  { name: 'Columbia', src: columbiaLogo, to: '/products?brand=columbia-taping-tools' },
  { name: 'Level 5', src: level5Logo, to: '/products?brand=level5' },
  { name: 'Platinum Drywall Tools', src: platinumLogo, to: '/products?brand=platinum' },
  { name: 'Asgard', src: asgardLogo, to: '/products?brand=asgard' },
  { name: 'SurPro', src: surproLogo, to: '/products?brand=surpro' },
];

export default function Home() {
  return (
    <>
      <SEOHead
        title="Professional Drywall Tools & Equipment"
        description="Top trusted one-stop shop for professional drywall tools. Get production-grade tools and parts at unbeatable prices with lightning-fast shipping."
        canonical="https://drywalltoolbox.com/"
        schema={[buildOrganizationSchema(), buildSiteLinksSearchBoxSchema()]}
      />

      <div className="page-wrapper dtb-home-page">
        <HeroSection
          titleLines={["The Pro Standard", "in Drywall."]}
          subtitle="Premium tools for every drywall job — unbeatable prices, lightning-fast shipping."
          brands={brandLogos}
        />

        <TrendingProducts />
      </div>
    </>
  );
}
