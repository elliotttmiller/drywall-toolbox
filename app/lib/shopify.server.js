/**
 * Shopify Storefront API client utilities.
 * These run server-side (in Hydrogen loaders/actions).
 */

/**
 * GraphQL Queries
 */
export const PRODUCTS_QUERY = `#graphql
  query Products(
    $country: CountryCode
    $language: LanguageCode
    $first: Int!
    $last: Int
    $startCursor: String
    $endCursor: String
    $query: String
    $sortKey: ProductSortKeys
    $reverse: Boolean
  ) @inContext(country: $country, language: $language) {
    products(
      first: $first,
      last: $last,
      before: $startCursor,
      after: $endCursor,
      query: $query,
      sortKey: $sortKey,
      reverse: $reverse
    ) {
      nodes {
        ...ProductCard
      }
      pageInfo {
        hasPreviousPage
        hasNextPage
        startCursor
        endCursor
      }
    }
  }
  ${PRODUCT_CARD_FRAGMENT}
`;

export const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      id
      title
      handle
      vendor
      description
      descriptionHtml
      options {
        name
        values
      }
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
        maxVariantPrice {
          amount
          currencyCode
        }
      }
      images(first: 10) {
        nodes {
          id
          url
          altText
          width
          height
        }
      }
      variants(first: 100) {
        nodes {
          id
          availableForSale
          quantityAvailable
          sku
          title
          price {
            currencyCode
            amount
          }
          compareAtPrice {
            currencyCode
            amount
          }
          selectedOptions {
            name
            value
          }
          image {
            id
            url
            altText
            width
            height
          }
          product {
            title
            handle
          }
        }
      }
      metafields(identifiers: [
        {namespace: "custom", key: "brand"},
        {namespace: "custom", key: "part_number"},
        {namespace: "custom", key: "upc"}
      ]) {
        namespace
        key
        value
      }
      seo {
        description
        title
      }
    }
  }
`;

export const COLLECTION_PRODUCTS_QUERY = `#graphql
  query CollectionProducts(
    $handle: String!
    $first: Int!
    $endCursor: String
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      title
      description
      image {
        id
        url
        altText
        width
        height
      }
      products(first: $first, after: $endCursor) {
        nodes {
          ...ProductCard
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
  ${PRODUCT_CARD_FRAGMENT}
`;

/**
 * Cart Mutations
 */
export const CART_CREATE_MUTATION = `#graphql
  mutation CartCreate(
    $input: CartInput!
    $country: CountryCode = ZZ
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    cartCreate(input: $input) {
      cart {
        ...CartFields
      }
      errors: userErrors {
        message
        field
        code
      }
    }
  }
  ${CART_FIELDS_FRAGMENT}
`;

export const CART_LINES_ADD_MUTATION = `#graphql
  mutation CartLinesAdd(
    $cartId: ID!
    $lines: [CartLineInput!]!
    $country: CountryCode = ZZ
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        ...CartFields
      }
      errors: userErrors {
        message
        field
        code
      }
    }
  }
  ${CART_FIELDS_FRAGMENT}
`;

export const CART_LINES_UPDATE_MUTATION = `#graphql
  mutation CartLinesUpdate(
    $cartId: ID!
    $lines: [CartLineUpdateInput!]!
    $country: CountryCode = ZZ
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart {
        ...CartFields
      }
      errors: userErrors {
        message
        field
        code
      }
    }
  }
  ${CART_FIELDS_FRAGMENT}
`;

export const CART_LINES_REMOVE_MUTATION = `#graphql
  mutation CartLinesRemove(
    $cartId: ID!
    $lineIds: [ID!]!
    $country: CountryCode = ZZ
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart {
        ...CartFields
      }
      errors: userErrors {
        message
        field
        code
      }
    }
  }
  ${CART_FIELDS_FRAGMENT}
`;

export const CART_QUERY = `#graphql
  query Cart(
    $cartId: ID!
    $country: CountryCode = ZZ
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    cart(id: $cartId) {
      ...CartFields
    }
  }
  ${CART_FIELDS_FRAGMENT}
`;

/**
 * Fragments
 */
const PRODUCT_CARD_FRAGMENT = `#graphql
  fragment ProductCard on Product {
    id
    title
    handle
    vendor
    description
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    images(first: 1) {
      nodes {
        id
        url
        altText
        width
        height
      }
    }
    variants(first: 1) {
      nodes {
        id
        availableForSale
        sku
        price {
          currencyCode
          amount
        }
        compareAtPrice {
          currencyCode
          amount
        }
      }
    }
    metafields(identifiers: [
      {namespace: "custom", key: "brand"},
      {namespace: "custom", key: "part_number"},
      {namespace: "custom", key: "upc"}
    ]) {
      namespace
      key
      value
    }
  }
`;

const CART_FIELDS_FRAGMENT = `#graphql
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    lines(first: 100) {
      nodes {
        id
        quantity
        cost {
          totalAmount {
            amount
            currencyCode
          }
          amountPerQuantity {
            amount
            currencyCode
          }
        }
        merchandise {
          ... on ProductVariant {
            id
            title
            sku
            price {
              currencyCode
              amount
            }
            image {
              url
              altText
            }
            product {
              title
              handle
              vendor
            }
          }
        }
      }
    }
    cost {
      subtotalAmount {
        amount
        currencyCode
      }
      totalAmount {
        amount
        currencyCode
      }
    }
    discountCodes {
      code
      applicable
    }
  }
`;
