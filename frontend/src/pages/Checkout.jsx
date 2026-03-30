import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useVeeqo } from '../context/VeeqoContext';
import { useWooCommerce } from '../context/WooCommerceContext';
import { 
  CreditCard, 
  Lock, 
  Truck, 
  CheckCircle,
  AlertCircle,
  Loader,
  ShoppingCart
} from 'lucide-react';
import DOMPurify from 'dompurify';

export default function Checkout() {
  const navigate = useNavigate();
  const { cartItems, getCartTotal, clearCart } = useCart();
  const veeqo = useVeeqo();
  const wooCommerce = useWooCommerce();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
    paymentMethod: 'stripe',
    cardNumber: '',
    cardExpiry: '',
    cardCvc: '',
    cardName: ''
  });

  const [errors, setErrors] = useState({});
  const [processing, setProcessing] = useState(false);
  const [inventoryStatus, setInventoryStatus] = useState(null);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);

  const subtotal = getCartTotal();
  const shipping = subtotal >= 500 ? 0 : 25;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;

  // Sanitize input
  const sanitizeInput = (value) => {
    return DOMPurify.sanitize(value, { ALLOWED_TAGS: [] });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: sanitizeInput(value)
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    if (!formData.phone.trim()) newErrors.phone = 'Phone is required';
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.state.trim()) newErrors.state = 'State is required';
    if (!formData.zip.trim()) newErrors.zip = 'ZIP code is required';

    // Payment validation
    if (!formData.cardNumber.trim()) newErrors.cardNumber = 'Card number is required';
    if (!formData.cardExpiry.trim()) newErrors.cardExpiry = 'Expiry date is required';
    if (!formData.cardCvc.trim()) newErrors.cardCvc = 'CVC is required';
    if (!formData.cardName.trim()) newErrors.cardName = 'Cardholder name is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkInventory = async () => {
    const checks = [];
    
    // Check Veeqo inventory if enabled
    if (veeqo.isEnabled) {
      try {
        const veeqoCheck = await veeqo.checkInventory(cartItems);
        checks.push({ source: 'Veeqo', ...veeqoCheck });
      } catch (error) {
        console.error('Veeqo inventory check failed:', error);
      }
    }

    // Check WooCommerce inventory if enabled
    if (wooCommerce.isEnabled) {
      try {
        const wooCheck = await wooCommerce.checkInventory(cartItems);
        checks.push({ source: 'WooCommerce', ...wooCheck });
      } catch (error) {
        console.error('WooCommerce inventory check failed:', error);
      }
    }

    // Combine results - order is available if all checks pass
    const allAvailable = checks.length === 0 || checks.every(check => check.available);
    const outOfStock = checks.flatMap(check => check.outOfStock || []);

    return {
      available: allAvailable,
      checks,
      outOfStock
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setProcessing(true);
    setInventoryStatus(null);

    try {
      // Step 1: Check inventory
      const inventoryCheck = await checkInventory();
      setInventoryStatus(inventoryCheck);

      if (!inventoryCheck.available) {
        setProcessing(false);
        return;
      }

      // Step 2: Process payment (simulated - in production, use real payment gateway)
      // This would integrate with Stripe, PayPal, etc.
      await simulatePaymentProcessing();

      // Step 3: Create orders in both systems
      const orders = {};

      // Create WooCommerce order
      if (wooCommerce.isEnabled) {
        try {
          const wooOrder = await wooCommerce.createOrder(
            cartItems,
            formData,
            formData.paymentMethod
          );
          
          // Mark order as paid (in production, do this after real payment confirmation)
          await wooCommerce.markOrderPaid(wooOrder.id, 'simulated_txn_' + Date.now());
          
          orders.wooCommerce = wooOrder;
        } catch (error) {
          console.error('WooCommerce order creation failed:', error);
          // Continue anyway - we can still fulfill via Veeqo
        }
      }

      // Create Veeqo order
      if (veeqo.isEnabled) {
        try {
          const veeqoOrder = await veeqo.createOrder(cartItems, formData);
          orders.veeqo = veeqoOrder;
        } catch (error) {
          console.error('Veeqo order creation failed:', error);
          // Continue anyway - order is still valid
        }
      }

      // Step 4: Complete order
      setOrderDetails(orders);
      setOrderComplete(true);
      clearCart();

    } catch (error) {
      console.error('Checkout failed:', error);
      alert(`Checkout failed: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const simulatePaymentProcessing = () => {
    return new Promise(resolve => setTimeout(resolve, 2000));
  };

  if (cartItems.length === 0 && !orderComplete) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-12 text-center max-w-2xl mx-auto">
            <ShoppingCart className="h-24 w-24 mx-auto mb-6 text-gray-300" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Your Cart is Empty</h2>
            <p className="text-gray-600 mb-8">
              Add some products to your cart before checking out.
            </p>
            <button
              onClick={() => navigate('/products')}
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all shadow-md hover:shadow-lg"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (orderComplete) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-12 text-center max-w-2xl mx-auto">
            <CheckCircle className="h-24 w-24 mx-auto mb-6 text-green-600" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Order Complete!</h2>
            <p className="text-gray-600 mb-8">
              Thank you for your order. A confirmation email has been sent to {formData.email}.
            </p>
            
            {orderDetails && (
              <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
                <h3 className="font-bold text-gray-900 mb-4">Order Details</h3>
                {orderDetails.wooCommerce && (
                  <p className="text-sm text-gray-700 mb-2">
                    WooCommerce Order ID: <span className="font-semibold">#{orderDetails.wooCommerce.id}</span>
                  </p>
                )}
                {orderDetails.veeqo && (
                  <p className="text-sm text-gray-700 mb-2">
                    Veeqo Order ID: <span className="font-semibold">#{orderDetails.veeqo.id}</span>
                  </p>
                )}
                <p className="text-sm text-gray-700">
                  Total: <span className="font-semibold">${total.toFixed(2)}</span>
                </p>
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => navigate('/products')}
                className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
              >
                Continue Shopping
              </button>
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 px-6 py-3 rounded-lg font-semibold transition-all"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 page-wrapper">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Checkout</h1>
          <p className="text-gray-600">Complete your order</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - Forms */}
            <div className="lg:col-span-2 space-y-6">
              {/* Customer Information */}
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Customer Information</h2>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                        errors.firstName ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.firstName && (
                      <p className="text-red-600 text-xs mt-1">{errors.firstName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                        errors.lastName ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.lastName && (
                      <p className="text-red-600 text-xs mt-1">{errors.lastName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                        errors.email ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.email && (
                      <p className="text-red-600 text-xs mt-1">{errors.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                        errors.phone ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.phone && (
                      <p className="text-red-600 text-xs mt-1">{errors.phone}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Truck size={20} />
                  Shipping Address
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                        errors.address ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.address && (
                      <p className="text-red-600 text-xs mt-1">{errors.address}</p>
                    )}
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        City <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                          errors.city ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.city && (
                        <p className="text-red-600 text-xs mt-1">{errors.city}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        State <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="state"
                        value={formData.state}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                          errors.state ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.state && (
                        <p className="text-red-600 text-xs mt-1">{errors.state}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        ZIP Code <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="zip"
                        value={formData.zip}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                          errors.zip ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.zip && (
                        <p className="text-red-600 text-xs mt-1">{errors.zip}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Information */}
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <CreditCard size={20} />
                  Payment Information
                </h2>

                {/* Payment Method Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Payment Method
                  </label>
                  <select
                    name="paymentMethod"
                    value={formData.paymentMethod}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="stripe">Credit Card (Stripe)</option>
                    <option value="paypal">PayPal</option>
                  </select>
                </div>

                {formData.paymentMethod === 'stripe' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Cardholder Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="cardName"
                        value={formData.cardName}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                          errors.cardName ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.cardName && (
                        <p className="text-red-600 text-xs mt-1">{errors.cardName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Card Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="cardNumber"
                        value={formData.cardNumber}
                        onChange={handleInputChange}
                        placeholder="1234 5678 9012 3456"
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                          errors.cardNumber ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.cardNumber && (
                        <p className="text-red-600 text-xs mt-1">{errors.cardNumber}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Expiry Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="cardExpiry"
                          value={formData.cardExpiry}
                          onChange={handleInputChange}
                          placeholder="MM/YY"
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                            errors.cardExpiry ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        {errors.cardExpiry && (
                          <p className="text-red-600 text-xs mt-1">{errors.cardExpiry}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          CVC <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="cardCvc"
                          value={formData.cardCvc}
                          onChange={handleInputChange}
                          placeholder="123"
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                            errors.cardCvc ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        {errors.cardCvc && (
                          <p className="text-red-600 text-xs mt-1">{errors.cardCvc}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {formData.paymentMethod === 'paypal' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      You will be redirected to PayPal to complete your payment.
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-4 text-sm text-gray-600">
                  <Lock size={16} />
                  <span>Secure SSL encrypted payment</span>
                </div>
              </div>

              {/* Inventory Status */}
              {inventoryStatus && !inventoryStatus.available && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-900 mb-2">Items Out of Stock</p>
                      <ul className="text-sm text-red-800 space-y-1">
                        {inventoryStatus.outOfStock.map(item => (
                          <li key={item.productId}>
                            {item.productName}: Requested {item.requested}, Available {item.available || 0}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-6 sticky top-24 border border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Order Summary</h2>

                {/* Cart Items */}
                <div className="space-y-3 mb-6">
                  {cartItems.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <div className="grow">
                        <p className="font-semibold text-gray-900">{item.name}</p>
                        <p className="text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-semibold text-gray-900">
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 pt-4 space-y-3 mb-6">
                  <div className="flex justify-between text-gray-700">
                    <span>Subtotal:</span>
                    <span className="font-semibold">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Shipping:</span>
                    <span className="font-semibold">
                      {shipping === 0 ? (
                        <span className="text-green-600">FREE</span>
                      ) : (
                        `$${shipping.toFixed(2)}`
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Tax (8%):</span>
                    <span className="font-semibold">${tax.toFixed(2)}</span>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold text-gray-900">Total:</span>
                    <span className="text-2xl font-bold text-primary-600">
                      ${total.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Integration Status */}
                {(veeqo.isEnabled || wooCommerce.isEnabled) && (
                  <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-semibold text-blue-900 mb-1">Active Integrations</p>
                    <div className="flex flex-wrap gap-2">
                      {veeqo.isEnabled && (
                        <span className="text-xs px-2 py-1 bg-blue-600 text-white rounded">
                          Veeqo
                        </span>
                      )}
                      {wooCommerce.isEnabled && (
                        <span className="text-xs px-2 py-1 bg-purple-600 text-white rounded">
                          WooCommerce
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={processing}
                  className="w-full inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-4 rounded-lg font-semibold text-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <>
                      <Loader className="animate-spin" size={20} />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Lock size={20} />
                      Complete Order
                    </>
                  )}
                </button>

                <p className="text-xs text-gray-500 text-center mt-4">
                  By completing your order, you agree to our terms and conditions
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
