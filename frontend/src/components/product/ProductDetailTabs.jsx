export default function ProductDetailTabs({ activeTab, setActiveTab, descriptionNode, specsNode, reviewsNode }) {
  const tabs = [
    { key: 'description', label: 'Description' },
    { key: 'specs', label: 'Specifications' },
    { key: 'reviews', label: 'Reviews' },
  ];

  return (
    <div className="pt-4 sm:pt-6 border-t border-gray-100">
      <div className="flex gap-2 mb-4 overflow-x-auto" role="tablist" aria-label="Product detail tabs">
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
            className={`px-3 py-2 text-sm rounded-full border ${activeTab === tab.key ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'description' ? (
        <div
          role="tabpanel"
          id="product-tabpanel-description"
          aria-labelledby="product-tab-description"
          className="prose max-w-none text-sm text-gray-700"
        >
          {descriptionNode}
        </div>
      ) : null}

      {activeTab === 'specs' ? (
        <div role="tabpanel" id="product-tabpanel-specs" aria-labelledby="product-tab-specs">
          <h3 className="sr-only">Technical Specifications</h3>
          {specsNode}
        </div>
      ) : null}

      {activeTab === 'reviews' ? (
        <div role="tabpanel" id="product-tabpanel-reviews" aria-labelledby="product-tab-reviews">{reviewsNode}</div>
      ) : null}
    </div>
  );
}
