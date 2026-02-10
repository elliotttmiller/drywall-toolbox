import { Link } from 'react-router-dom';
import { Wrench } from 'lucide-react';

export default function Home() {
  return (
    <section style={{ 
      padding: '140px 40px 80px', 
      minHeight: '100vh' 
    }} className="section-enter">
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 0.8fr',
        gap: '40px',
        maxWidth: '1400px',
        margin: '0 auto'
      }}
      className="home-hero-grid"
      >
        <div>
          <h1 className="machined-title" style={{ marginBottom: '40px' }}>
            ENGINEERED<br />FOR PRECISION<br />WALL FINISHES.
          </h1>
          <p style={{ 
            maxWidth: '500px', 
            marginBottom: '40px', 
            fontSize: '1.1rem', 
            opacity: 0.7 
          }}>
            The industry standard for professional drywall contractors. High-tension alloy tools 
            designed for lifelong durability and flawless execution.
          </p>
          <Link to="/products" className="alloy-button" style={{ textDecoration: 'none' }}>
            Explore Catalog
          </Link>
        </div>
        
        <div style={{
          background: 'var(--alloy-mid)',
          height: '500px',
          clipPath: 'polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        className="home-hero-icon"
        >
          <Wrench 
            size={200} 
            color="var(--alloy-deep)" 
            strokeWidth={0.5}
            strokeDasharray="2 2"
          />
        </div>
      </div>
    </section>
  );
}
