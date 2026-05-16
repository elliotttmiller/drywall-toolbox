import { useState, useEffect, useCallback } from 'react';
import { getProducts } from '../../services/catalog';
import { getProductVariations } from '../../services/api';
import { useCart } from '../../context/CartContext';
import ProductDetail from '../product/ProductDetail';
import ProductModal from '../product/ProductModal';
import Toast from '../ui/Toast';
import StorefrontRail from './StorefrontRail';
import StorefrontProductTile from './StorefrontProductTile';
import StorefrontSkeletons from './StorefrontSkeletons';
import { PLACEHOLDER_IMAGE } from '../../constants/images.js';
import { fetchVariationsBatched } from '../../utils/variationSelection';

/**
 * A horizontal product rail that fetches products from the catalog API.
 *
 * @param {{ category?: string, brand?: string, sort?: string, maxItems?: number, label?: string }} props
 */
export default function StorefrontProductRail({
  category,
  brand,
  sort,
  maxItems = 12,
  label = 'Products',
}) {
  const [products, setProducts] = useState([]);
  const [variationMap, setVariationMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [modalProduct, setModalProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addToCart } = useCart();

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setModalProduct(null);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeModal]);

  useEffect(() => {
    let mounted = true;

    getProducts().then((allProducts) => {
      if (!mounted) return;

      let filtered = allProducts;

      if (category) {
        filtered = filtered.filter((p) => {
          const cat = (p.category || '').toLowerCase().replace(/\s+/g, '_');
          const displayCat = (p.display_category || '').toLowerCase();
          return cat.includes(category.toLowerCase()) || displayCat.includes(category.toLowerCase());
        });
      }

      if (brand) {
        const brandLower = brand.toLowerCase();
        filtered = filtered.filter((p) => (p.brand || '').toLowerCase().includes(brandLower));
      }

      if (sort === 'newest') {
        filtered = filtered.slice().sort((a, b) => {
          const dateA = new Date(a.date_created || 0);
          const dateB = new Date(b.date_created || 0);
          return dateB - dateA; // newest first
        });
      } else if (sort === 'price_asc') {
        filtered = filtered.slice().sort((a, b) => {
          const pa = Number(a.price || a.min_price || 0);
          const pb = Number(b.price || b.min_price || 0);
          return pa - pb;
        });
      }

      setProducts(filtered.slice(0, maxItems));
      setLoading(false);
    }).catch((err) => {
      console.error('StorefrontProductRail fetch error:', err);
      if (mounted) setLoading(false);
    });

    return () => { mounted = false; };
  }, [category, brand, sort, maxItems]);

  const variableIdsKey = products
    .filter((p) => p.is_variable && p.id)
    .map((p) => String(p.id))
    .join(',');

  useEffect(() => {
    const ids = products
      .filter((p) => p.is_variable && p.id && !variationMap[p.id])
      .map((p) => p.id);
    if (ids.length === 0) return;

    let mounted = true;
    fetchVariationsBatched(ids, getProductVariations).then((pairs) => {
      if (!mounted) return;
      const next = {};
      pairs.forEach(([id, vars]) => { next[id] = vars; });
      setVariationMap((prev) => ({ ...prev, ...next }));
    });

    return () => { mounted = false; };
  }, [variableIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddToCart = (product) => {
    addToCart(product, 1);
    setToast({ message: `${product.name} added to cart!`, type: 'cart' });
  };

  const openModal = (product) => {
    setModalProduct(product);
    setIsModalOpen(true);
  };

  if (loading) {
    return <StorefrontSkeletons count={4} />;
  }

  if (products.length === 0) return null;

  return (
    <>
      <StorefrontRail label={label} className="storefront-rail--fixed-tiles">
        {products.map((product, index) => {
          const variations = variationMap[product.id] || [];
          const firstVarImg = variations.find(
            (v) => v.image && v.image !== PLACEHOLDER_IMAGE
          )?.image;
          const cardProduct =
            (product.image === PLACEHOLDER_IMAGE || !product.image) && firstVarImg
              ? { ...product, image: firstVarImg, image_thumbnail: firstVarImg }
              : product;

          return (
            <StorefrontProductTile
              key={product.sku || product.id}
              product={product}
              cardProduct={cardProduct}
              onOpenModal={() => openModal(product)}
              onAddToCart={() => handleAddToCart(product)}
              index={index}
            />
          );
        })}
      </StorefrontRail>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <ProductModal isOpen={isModalOpen && !!modalProduct} product={modalProduct} onClose={closeModal}>
        {modalProduct && (
          <ProductDetail
            product={modalProduct}
            onAddToCart={handleAddToCart}
            onClose={closeModal}
            initialVariations={variationMap[modalProduct.id] || []}
          />
        )}
      </ProductModal>
    </>
  );
}
