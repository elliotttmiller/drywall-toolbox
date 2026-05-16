export default function ProductDetailTabs({ activeTab, setActiveTab, descriptionNode, specsNode, reviewsNode }) {
  const tabs = [
    { key: 'description', label: 'Description' },
    { key: 'specs', label: 'Specifications' },
    { key: 'reviews', label: 'Reviews' },
  ];

  return (
    <div className="dtb-pdp-sections">
      <div className="dtb-pdp-tabs" role="tablist" aria-label="Product detail tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            role="tab"
            id={`product-tab-${tab.key}`}
            aria-controls={`product-tabpanel-${tab.key}`}
            aria-selected={activeTab === tab.key}
            tabIndex={activeTab === tab.key ? 0 : -1}
            className={`dtb-pdp-tabs__tab ${activeTab === tab.key ? 'is-active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section className="dtb-pdp-section">
        <div className="dtb-pdp-section__heading-wrap">
          <h3 className="dtb-pdp-section__heading">Description</h3>
          <span className="dtb-pdp-section__underline" aria-hidden="true" />
        </div>
        <div
          role="tabpanel"
          id="product-tabpanel-description"
          aria-labelledby="product-tab-description"
          className={`dtb-pdp-section__content prose max-w-none text-sm text-gray-700 ${activeTab === 'description' ? 'dtb-pdp-section__content--active' : ''}`}
        >
          {descriptionNode}
        </div>
      </section>

      <section className="dtb-pdp-section">
        <div className="dtb-pdp-section__heading-wrap">
          <h3 className="dtb-pdp-section__heading">Specifications</h3>
          <span className="dtb-pdp-section__underline" aria-hidden="true" />
        </div>
        <div role="tabpanel" id="product-tabpanel-specs" aria-labelledby="product-tab-specs" className={`dtb-pdp-section__content ${activeTab === 'specs' ? 'dtb-pdp-section__content--active' : ''}`}>
          {specsNode}
        </div>
      </section>

      <section className="dtb-pdp-section">
        <div className="dtb-pdp-section__heading-wrap">
          <h3 className="dtb-pdp-section__heading">Reviews</h3>
          <span className="dtb-pdp-section__underline" aria-hidden="true" />
        </div>
        <div role="tabpanel" id="product-tabpanel-reviews" aria-labelledby="product-tab-reviews" className={`dtb-pdp-section__content ${activeTab === 'reviews' ? 'dtb-pdp-section__content--active' : ''}`}>{reviewsNode}</div>
      </section>
    </div>
  );
}
