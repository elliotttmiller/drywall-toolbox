import TechnicalSpecifications from './TechnicalSpecifications';

export default function ProductSpecTable({ specs, onItemClick }) {
  return <TechnicalSpecifications specs={specs} onItemClick={onItemClick} />;
}
