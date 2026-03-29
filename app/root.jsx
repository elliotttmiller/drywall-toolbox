import {useEffect, useState} from 'react';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
} from 'react-router-dom';
import {Analytics} from '@shopify/hydrogen';
import {CartProvider} from '~/context/CartContext';
import {VeeqoProvider} from '~/context/VeeqoContext';
import Header from '~/components/Header';
import Footer from '~/components/Footer';
import CartSidebar from '~/components/CartSidebar';

import '~/styles/index.css';
import '~/styles/machined-design.css';

export const meta = () => [
  {charset: 'utf-8'},
  {name: 'viewport', content: 'width=device-width,initial-scale=1,viewport-fit=cover'},
];

export async function loader({context}) {
  const {env} = context;
  return {
    publicStoreDomain: env?.PUBLIC_STORE_DOMAIN || '',
    publicStorefrontToken: env?.PUBLIC_STOREFRONT_API_TOKEN || '',
    storefrontApiVersion: env?.PUBLIC_STOREFRONT_API_VERSION || '2024-10',
    shopAnalytics: {
      shopId: env?.PUBLIC_STOREFRONT_ID || '',
    },
  };
}

export function Layout({children}) {
  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function ShopifyConfigInjector({publicStoreDomain, publicStorefrontToken, storefrontApiVersion}) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__shopifyConfig = {
        storeDomain: publicStoreDomain,
        publicStorefrontToken,
        apiVersion: storefrontApiVersion,
      };
    }
  }, [publicStoreDomain, publicStorefrontToken, storefrontApiVersion]);
  return null;
}

export default function App() {
  const {publicStoreDomain, publicStorefrontToken, storefrontApiVersion, shopAnalytics} =
    useLoaderData();
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <>
      <ShopifyConfigInjector
        publicStoreDomain={publicStoreDomain}
        publicStorefrontToken={publicStorefrontToken}
        storefrontApiVersion={storefrontApiVersion}
      />
      <VeeqoProvider>
        <CartProvider>
          {/* Background Texture */}
          <div className="machined-bg" />
          <div style={{display: 'flex', flexDirection: 'column', minHeight: '100vh'}}>
            <Header onCartToggle={() => setCartOpen((o) => !o)} />
            <main style={{flexGrow: 1}} className="main-content">
              <Outlet />
            </main>
            <Footer />
          </div>
          <CartSidebar isOpen={cartOpen} onClose={() => setCartOpen(false)} />
          <Analytics.Provider shopId={shopAnalytics.shopId} />
        </CartProvider>
      </VeeqoProvider>
    </>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  let message = 'An unexpected error occurred';
  let details = '';
  let stack;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? 'Page Not Found' : 'Error';
    details =
      error.status === 404
        ? 'The requested page could not be found.'
        : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main style={{padding: '4rem 2rem', textAlign: 'center'}}>
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre style={{textAlign: 'left', overflow: 'auto', padding: '1rem', background: '#f5f5f5'}}>
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
