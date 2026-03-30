import { Search } from 'lucide-react';

export default function SearchBar({ placeholder = "Search products...", value = "", onChange = () => {} }) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        maxWidth: '600px'
      }}>
        <Search 
          size={20} 
          style={{
            position: 'absolute',
            left: '12px',
            color: 'rgba(15,23,42,0.5)',
            pointerEvents: 'none',
            flexShrink: 0
          }}
        />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          style={{
            width: '100%',
            padding: 'clamp(10px, 2vw, 14px) clamp(10px, 2vw, 14px) clamp(10px, 2vw, 14px) 40px',
            fontSize: 'clamp(16px, 2vw, 1rem)',
            border: '1px solid rgb(229, 231, 235)',
            borderRadius: '8px',
            backgroundColor: 'white',
            transition: 'all 0.2s ease-out',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            outline: 'none',
            fontFamily: 'inherit',
            WebkitAppearance: 'none',
            appearance: 'none',
            minHeight: '44px'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary-600)';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgb(229, 231, 235)';
            e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
          }}
        />
      </div>
    </div>
  );
}
