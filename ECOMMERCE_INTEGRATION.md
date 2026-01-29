# E-commerce Integration Guide

This document explains how to integrate and configure Veeqo and WooCommerce with the Drywall Toolbox e-commerce platform.

## Table of Contents

1. [Overview](#overview)
2. [Veeqo Integration](#veeqo-integration)
3. [WooCommerce Integration](#woocommerce-integration)
4. [Unified Checkout Workflow](#unified-checkout-workflow)
5. [Configuration](#configuration)
6. [Troubleshooting](#troubleshooting)

## Overview

The Drywall Toolbox platform supports integration with two major e-commerce systems:

- **Veeqo**: For inventory management, order fulfillment, and warehouse operations
- **WooCommerce**: For product catalog, order management, and payment processing

Both integrations can be used simultaneously to create a comprehensive e-commerce solution.

### Key Features

- ✅ Real-time inventory synchronization
- ✅ Automated order management
- ✅ Multi-channel inventory tracking
- ✅ Payment gateway integration
- ✅ Unified checkout experience
- ✅ Order status tracking

## Veeqo Integration

### What is Veeqo?

Veeqo is a cloud-based inventory and order management platform that helps retailers manage stock across multiple sales channels, streamline fulfillment, and automate shipping processes.

### Setup Instructions

#### 1. Create a Veeqo Account

1. Visit [https://www.veeqo.com](https://www.veeqo.com)
2. Sign up for an account
3. Complete the onboarding process

#### 2. Register Your Application

1. Contact Veeqo support at helpme@support.veeqo.com
2. Request OAuth 2.0 credentials for your application
3. Provide:
   - Application name: "Drywall Toolbox"
   - Redirect URI: `https://your-domain.com/veeqo/callback`
4. Receive your Client ID and Client Secret

#### 3. Configure Veeqo in the Application

1. Navigate to **Settings → Veeqo Integration** (`/settings/veeqo`)
2. Enter your Veeqo credentials:
   - Client ID
   - Client Secret
   - Redirect URI (should match what you registered)
3. Enable the integration
4. Click **Save Settings**
5. Click **Connect** to authorize the integration
6. You'll be redirected to Veeqo to grant permissions
7. After authorization, you'll be redirected back to the app

#### 4. Verify Connection

1. Return to the Veeqo settings page
2. Check that the status shows "Connected to Veeqo"
3. Click **Sync Now** to test product synchronization

### Veeqo Features

#### Inventory Management

- Real-time stock level tracking across all warehouses
- Automatic inventory checks before checkout
- Out-of-stock prevention
- Multi-location inventory support

#### Order Synchronization

When a customer completes an order:

1. Order details are automatically sent to Veeqo
2. Inventory is reserved
3. Order appears in your Veeqo dashboard
4. Fulfillment team can process the order
5. Shipping and tracking information syncs back

#### API Endpoints Used

- `GET /products` - Fetch product catalog
- `GET /products/:id/inventory` - Check inventory levels
- `POST /orders` - Create new orders
- `GET /orders/:id` - Retrieve order details
- `PUT /orders/:id` - Update order status

### Environment Variables

```bash
VITE_VEEQO_CLIENT_ID=your_client_id
VITE_VEEQO_CLIENT_SECRET=your_client_secret
VITE_VEEQO_REDIRECT_URI=https://your-domain.com/veeqo/callback
```

## WooCommerce Integration

### What is WooCommerce?

WooCommerce is the world's most popular open-source e-commerce platform built on WordPress, providing comprehensive product management, payment processing, and order management capabilities.

### Setup Instructions

#### 1. Install WooCommerce

1. Ensure you have a WordPress website
2. Install the WooCommerce plugin from the WordPress plugin directory
3. Complete the WooCommerce setup wizard

#### 2. Generate API Keys

1. Log in to your WordPress admin dashboard
2. Go to **WooCommerce → Settings → Advanced → REST API**
3. Click **Add Key**
4. Configure the API key:
   - Description: "Drywall Toolbox Integration"
   - User: Select an administrator user
   - Permissions: **Read/Write**
5. Click **Generate API Key**
6. **Important**: Copy the Consumer Key and Consumer Secret immediately
   - They will only be shown once!

#### 3. Configure WooCommerce in the Application

1. Navigate to **Settings → WooCommerce Integration** (`/settings/woocommerce`)
2. Enter your WooCommerce credentials:
   - Store URL: `https://your-store.com`
   - Consumer Key: `ck_...`
   - Consumer Secret: `cs_...`
3. Enable the integration
4. Click **Save Settings**
5. Click **Test Connection** to verify the API is working

#### 4. Configure Payment Gateways

1. In your WordPress admin, go to **WooCommerce → Settings → Payments**
2. Enable and configure your desired payment gateways:
   - Stripe
   - PayPal
   - Direct Bank Transfer
   - Cash on Delivery
3. The active payment gateways will automatically appear in your checkout

### WooCommerce Features

#### Product Management

- Sync products from WooCommerce catalog
- Automatic product data updates
- Category and tag support
- Variable product support

#### Order Management

When a customer completes an order:

1. Order is created in WooCommerce with "pending" status
2. Payment is processed through configured gateway
3. On successful payment, order status updates to "processing"
4. Order appears in WooCommerce admin dashboard
5. Email notifications are sent automatically

#### Payment Processing

- Support for multiple payment gateways
- Secure payment token handling
- PCI compliance maintained
- Transaction ID tracking
- Automatic order status updates

#### Stock Management

- Real-time inventory tracking
- Stock quantity management
- Low stock notifications
- Out-of-stock prevention

### API Endpoints Used

- `GET /products` - Fetch product catalog
- `GET /products/:id` - Get product details
- `POST /orders` - Create new orders
- `PUT /orders/:id` - Update order status
- `GET /payment_gateways` - List available payment methods
- `GET /shipping_methods` - Get shipping options

### Environment Variables

```bash
VITE_WOOCOMMERCE_STORE_URL=https://your-store.com
VITE_WOOCOMMERCE_CONSUMER_KEY=ck_...
VITE_WOOCOMMERCE_CONSUMER_SECRET=cs_...
```

## Unified Checkout Workflow

The application provides a seamless checkout experience that integrates both Veeqo and WooCommerce.

### Checkout Process

1. **Customer Information**
   - First name, last name
   - Email and phone number
   - Collected for both systems

2. **Shipping Address**
   - Complete address details
   - Used for both order creation and fulfillment

3. **Inventory Validation**
   - Checks inventory in Veeqo (if enabled)
   - Checks inventory in WooCommerce (if enabled)
   - Prevents overselling by validating against all sources

4. **Payment Processing**
   - Customer selects payment method
   - Payment details collected securely
   - Payment processed through WooCommerce gateway
   - Transaction recorded

5. **Order Creation**
   - **WooCommerce**: Order created with complete details
     - Initially set to "pending payment"
     - Updated to "processing" after payment confirmation
     - Transaction ID recorded
   - **Veeqo**: Order created for fulfillment
     - Customer information
     - Line items
     - Shipping details
     - Order notes

6. **Confirmation**
   - Order confirmation displayed
   - Order IDs from both systems shown
   - Confirmation email sent (via WooCommerce)
   - Cart cleared

### Integration Flow Diagram

```
Customer Checkout
       ↓
 Validate Inventory
    ↙      ↘
Veeqo    WooCommerce
    ↘      ↙
  All Stock Available?
       ↓ Yes
  Process Payment
       ↓
  Create Orders
    ↙      ↘
Veeqo    WooCommerce
(Fulfillment) (Payment)
    ↘      ↙
  Order Complete!
```

### Handling Different Integration Scenarios

#### Both Integrations Enabled

- Inventory checked in both systems
- Orders created in both systems
- Payment processed through WooCommerce
- Fulfillment managed in Veeqo

#### Only Veeqo Enabled

- Inventory checked in Veeqo
- Order created in Veeqo
- Payment processed locally (simulated)
- Fulfillment managed in Veeqo

#### Only WooCommerce Enabled

- Inventory checked in WooCommerce
- Order created in WooCommerce
- Payment processed through WooCommerce gateway
- Fulfillment managed through WooCommerce

#### Neither Integration Enabled

- No inventory validation (all items assumed in stock)
- Order details collected but not synced
- Payment simulated
- Manual order processing required

## Configuration

### Setting Up Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your credentials:
   ```bash
   # Veeqo
   VITE_VEEQO_CLIENT_ID=your_actual_client_id
   VITE_VEEQO_CLIENT_SECRET=your_actual_client_secret
   VITE_VEEQO_REDIRECT_URI=https://yourdomain.com/veeqo/callback
   
   # WooCommerce
   VITE_WOOCOMMERCE_STORE_URL=https://your-woocommerce-store.com
   VITE_WOOCOMMERCE_CONSUMER_KEY=ck_your_actual_key
   VITE_WOOCOMMERCE_CONSUMER_SECRET=cs_your_actual_secret
   ```

3. Restart your development server:
   ```bash
   npm run dev
   ```

### Security Considerations

- **Never commit `.env` file to version control**
- Store API credentials securely
- Use HTTPS for all production deployments
- Rotate API keys periodically
- Limit API key permissions to only what's needed
- Monitor API usage for suspicious activity

### Production Deployment

For production deployment:

1. Set environment variables in your hosting platform
2. Ensure HTTPS is enabled
3. Configure proper CORS headers
4. Set up webhook endpoints for real-time updates
5. Implement proper error logging
6. Set up monitoring and alerts

## Troubleshooting

### Veeqo Issues

#### "Veeqo authentication expired"

**Solution**: 
1. Go to Settings → Veeqo Integration
2. Click Disconnect
3. Click Connect again to re-authorize

#### "No Veeqo access token available"

**Solution**:
1. Verify your Client ID and Client Secret are correct
2. Ensure the Redirect URI matches exactly what you registered
3. Complete the OAuth flow by clicking Connect

#### Products not syncing

**Solution**:
1. Check connection status
2. Verify API credentials
3. Check browser console for errors
4. Try clicking "Sync Now" manually
5. Ensure you have products in your Veeqo account

### WooCommerce Issues

#### "WooCommerce API error: 401"

**Solution**:
1. Verify Consumer Key and Consumer Secret are correct
2. Ensure the API key has Read/Write permissions
3. Check that the Store URL is correct (including https://)
4. Verify the user account associated with the API key is an administrator

#### "Connection test failed"

**Solution**:
1. Verify your store URL is accessible
2. Check that WooCommerce REST API is enabled
3. Ensure WordPress permalinks are set (not default)
4. Check for any security plugins that might block API access
5. Verify SSL certificate is valid (if using HTTPS)

#### Payment processing fails

**Solution**:
1. Verify payment gateway is enabled in WooCommerce
2. Check payment gateway API credentials
3. Ensure payment gateway is in live mode (not test mode) for production
4. Check WooCommerce logs for payment errors

### General Issues

#### Orders not appearing in both systems

**Solution**:
1. Check that both integrations are enabled
2. Verify connection status for both
3. Check browser console for errors
4. Test each integration individually
5. Review error logs

#### Inventory showing incorrect

**Solution**:
1. Sync products from source systems
2. Verify products exist in both systems with matching IDs
3. Check inventory levels directly in Veeqo/WooCommerce
4. Force a manual sync

#### Checkout fails

**Solution**:
1. Check browser console for JavaScript errors
2. Verify all required form fields are filled
3. Test with integrations disabled
4. Check network tab for failed API requests
5. Review server logs

### Getting Help

If you continue to experience issues:

1. Check the browser console for detailed error messages
2. Review the integration settings
3. Test API connections individually
4. Contact support with:
   - Exact error message
   - Steps to reproduce
   - Browser and version
   - Screenshots if applicable

## API Rate Limits

### Veeqo

- 5 requests per second per access token
- Monitor `X-RateLimit-*` headers in responses

### WooCommerce

- 10 requests per minute for free plans
- Higher limits for premium hosting
- Implement exponential backoff for rate limit errors

## Best Practices

1. **Regular Syncing**: Set up automated product syncs daily
2. **Error Monitoring**: Monitor integration errors in production
3. **Testing**: Test order flow in a staging environment first
4. **Backup**: Keep regular backups of order data
5. **Documentation**: Document any custom configurations
6. **Updates**: Keep WooCommerce and plugins updated
7. **Security**: Regular security audits of API access

## Additional Resources

### Veeqo

- [Veeqo Developer Portal](https://developers.veeqo.com/)
- [Veeqo API Documentation](https://developers.veeqo.com/api)
- [Veeqo Help Center](https://help.veeqo.com/)

### WooCommerce

- [WooCommerce REST API Docs](https://woocommerce.github.io/woocommerce-rest-api-docs/)
- [WooCommerce Developer Documentation](https://developer.woocommerce.com/)
- [WooCommerce Support](https://woocommerce.com/support/)

---

**Last Updated**: January 2026
