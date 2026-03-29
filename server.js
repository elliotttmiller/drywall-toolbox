import {createRequestHandler, getStorefrontHeaders} from '@shopify/remix-oxygen';
import {createStorefrontClient, createCartHandler, cartGetIdDefault, cartSetIdDefault} from '@shopify/hydrogen';

/**
 * Oxygen server entry point.
 * Runs in the Cloudflare Workers / Oxygen runtime.
 */
export default {
  async fetch(request, env, executionContext) {
    try {
      /**
       * Open a cache instance in the worker and check if it's bound to the platform.
       */
      if (!env?.SESSION_SECRET) {
        throw new Error('SESSION_SECRET environment variable is not set');
      }

      /**
       * Create a Shopify Storefront client.
       */
      const {storefront} = createStorefrontClient({
        cache: await caches.open('hydrogen'),
        waitUntil: (p) => executionContext.waitUntil(p),
        i18n: {language: 'EN', country: 'US'},
        publicStorefrontToken: env.PUBLIC_STOREFRONT_API_TOKEN,
        privateStorefrontToken: env.PRIVATE_STOREFRONT_API_TOKEN,
        storeDomain: env.PUBLIC_STORE_DOMAIN,
        storefrontHeaders: getStorefrontHeaders(request),
        storefrontApiVersion: env.PUBLIC_STOREFRONT_API_VERSION || '2024-10',
      });

      /**
       * Create a cart handler.
       */
      const cart = createCartHandler({
        storefront,
        getCartId: cartGetIdDefault(request.headers),
        setCartId: cartSetIdDefault(),
        cartQueryFragment: CART_QUERY_FRAGMENT,
      });

      /**
       * Create a Remix request handler and pass it the Shopify context.
       */
      const handleRequest = createRequestHandler({
        // @ts-ignore
        build: await import('./build/server'),
        mode: process.env.NODE_ENV,
        getLoadContext() {
          return {
            session: null, // session handling can be added if needed
            storefront,
            cart,
            env,
            waitUntil: executionContext.waitUntil.bind(executionContext),
          };
        },
      });

      const response = await handleRequest(request);

      if (response.status === 404) {
        /**
         * Check for redirects only when there's a 404 from the app.
         * If the redirect doesn't exist, then `patchedResponse` is an error response.
         */
        return response;
      }

      return response;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      return new Response('An unexpected error occurred', {status: 500});
    }
  },
};

/**
 * Cart query fragment used to fetch the cart with all needed fields.
 * @see https://shopify.dev/docs/api/storefront/latest/queries/cart
 */
const CART_QUERY_FRAGMENT = `#graphql
  fragment Money on MoneyV2 {
    currencyCode
    amount
  }
  fragment CartLine on CartLine {
    id
    quantity
    attributes {
      key
      value
    }
    cost {
      totalAmount {
        ...Money
      }
      amountPerQuantity {
        ...Money
      }
      compareAtAmountPerQuantity {
        ...Money
      }
    }
    merchandise {
      ... on ProductVariant {
        id
        availableForSale
        compareAtPrice {
          ...Money
        }
        price {
          ...Money
        }
        requiresShipping
        title
        image {
          id
          url
          altText
          width
          height
        }
        product {
          handle
          title
          id
          vendor
        }
        selectedOptions {
          name
          value
        }
      }
    }
  }
  fragment CartApiQuery on Cart {
    updatedAt
    id
    checkoutUrl
    totalQuantity
    buyerIdentity {
      countryCode
      customer {
        id
        email
        firstName
        lastName
        displayName
      }
      email
      phone
    }
    lines(first: $numCartLines) {
      nodes {
        ...CartLine
      }
    }
    cost {
      subtotalAmount {
        ...Money
      }
      totalAmount {
        ...Money
      }
      totalDutyAmount {
        ...Money
      }
      totalTaxAmount {
        ...Money
      }
    }
    note
    attributes {
      key
      value
    }
    discountCodes {
      code
      applicable
    }
  }
`;
