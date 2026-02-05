import { Link } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import '../styles/home-responsive.css';

export default function Home() {
  return (
    <section className="home-hero section-enter">
      <div className="home-grid">
        <div className="home-content">
          <h1 className="machined-title home-title">
            ENGINEERED<br />FOR PRECISION<br />WALL FINISHES.
          </h1>
          <p className="home-description">
            The industry standard for professional drywall contractors. High-tension alloy tools 
            designed for lifelong durability and flawless execution.
          </p>
          <Link to="/products" className="alloy-button" style={{ textDecoration: 'none' }}>
            Explore Catalog
          </Link>
        </div>
        
        <div className="home-graphic">
          <Wrench 
            className="home-icon"
            color="var(--alloy-deep)" 
            strokeWidth={0.5}
            strokeDasharray="2 2"
          />
        </div>
      </div>
    </section>
  );
}
