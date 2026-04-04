import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useVeeqo } from '../context/VeeqoContext';
import { syncAndPlace } from '../api/cart.js';
import {
  CreditCard,
  Lock,
  Truck,
  CheckCircle,
  AlertCircle,
  Loader,
  ShoppingCart,
} from 'lucide-react';
import DOMPurify from 'dompurify';

// ─── Payment method options ────────────────────────────────────────────────────
// IDs must match WC payment gateway slugs enabled in WP Admin →
// WooCommerce → Settings → Payments.
// 'cod' (Cash on Delivery / Check / Invoice) requires no frontend JS SDK and
// is a safe default.  Add 'stripe' / 'paypal' once their WC gateways are live.
const PAYMENT_METHODS = [
  { id: 'cod',    label: 'Check / Invoice (Pay on receipt)' },
  { id: 'bacs',   label: 'Direct Bank Transfer (BACS)'       },
];

export default function Checkout() {
  const navigate     = useNavigate();
  const { cartItems, getCartTotal, clearCart } = useCart();
  const veeqo        = useVeeqo();

  const [formData, setFormData] = useState( {
    firstName:     '',
    lastName:      '',
    email:         '',
    phone:         '',
    address:       '',
    city:          '',
    state:         '',
    zip:           '',
    country:       'US',
    paymentMethod: 'cod',
    customerNote:  '',
  } );

  const [errors,        setErrors       ] = useState( {} );
  const [processing,    setProcessing   ] = useState( false );
  const [checkoutError, setCheckoutError] = useState( null );
  const [orderComplete, setOrderComplete] = useState( false );
  const [orderDetails,  setOrderDetails ] = useState( null );
  const [step,          setStep         ] = useState( 'form' ); // 'form' | 'syncing' | 'placing'

  const subtotal = getCartTotal();
  const shipping = subtotal >= 500 ? 0 : 25;
  const tax      = subtotal * 0.08;
  const total    = subtotal + shipping + tax;

  const sanitize = ( v ) => DOMPurify.sanitize( v, { ALLOWED_TAGS: [] } );

  const handleInputChange = ( e ) => {
    const { name, value } = e.target;
    setFormData( ( prev ) => ( { ...prev, [name]: sanitize( value ) } ) );
    if ( errors[name] ) setErrors( ( prev ) => ( { ...prev, [name]: '' } ) );
  };

  const validateForm = () => {
    const e = {};
    if ( ! formData.firstName.trim() ) e.firstName = 'First name is required';
    if ( ! formData.lastName.trim()  ) e.lastName  = 'Last name is required';
    if ( ! formData.email.trim()     ) {
      e.email = 'Email is required';
    } else if ( ! /\S+@\S+\.\S+/.test( formData.email ) ) {
      e.email = 'Email is invalid';
    }
    if ( ! formData.phone.trim()   ) e.phone   = 'Phone is required';
    if ( ! formData.address.trim() ) e.address = 'Address is required';
    if ( ! formData.city.trim()    ) e.city    = 'City is required';
    if ( ! formData.state.trim()   ) e.state   = 'State is required';
    if ( ! formData.zip.trim()     ) e.zip     = 'ZIP code is required';
    setErrors( e );
    return Object.keys( e ).length === 0;
  };

  const handleSubmit = async ( e ) => {
    e.preventDefault();
    if ( ! validateForm() ) return;

    setProcessing( true );
    setCheckoutError( null );

    const billingAddress = {
      first_name: formData.firstName,
      last_name:  formData.lastName,
      address_1:  formData.address,
      address_2:  '',
      city:       formData.city,
      state:      formData.state,
      postcode:   formData.zip,
      country:    formData.country,
      email:      formData.email,
      phone:      formData.phone,
    };

    try {
      // ── Step 1: Sync CartContext → WC Store API cart, then submit checkout ──
      setStep( 'syncing' );
      const wcOrder = await syncAndPlace(
        cartItems,
        billingAddress,
        billingAddress,      // use billing as shipping (user can update in WP later)
        formData.paymentMethod,
        [],                  // payment_data — extend here for Stripe/PayPal tokens
        formData.customerNote,
      );

      setStep( 'placing' );

      // ── Step 2 (optional): Also create a Veeqo order for fulfilment ──────
      let veeqoOrder = null;
      if ( veeqo.isEnabled ) {
        try {
          veeqoOrder = await veeqo.createOrder( cartItems, formData );
        } catch ( err ) {
          console.error( 'Veeqo order creation failed (non-fatal):', err );
        }
      }

      setOrderDetails( { wooCommerce: wcOrder, veeqo: veeqoOrder } );
      setOrderComplete( true );
      clearCart();

    } catch ( err ) {
      setCheckoutError( err.message || 'Checkout failed. Please try again.' );
    } finally {
      setProcessing( false );
      setStep( 'form' );
    }
  };

  // ── Empty cart guard ─────────────────────────────────────────────────────────
  if ( cartItems.length === 0 && ! orderComplete ) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-12 text-center max-w-2xl mx-auto">
            <ShoppingCart className="h-24 w-24 mx-auto mb-6 text-gray-300" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Your Cart is Empty</h2>
            <p className="text-gray-600 mb-8">Add some products to your cart before checking out.</p>
            <button
              onClick={ () => navigate( '/products' ) }
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all shadow-md hover:shadow-lg"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Order confirmation screen ────────────────────────────────────────────────
  if ( orderComplete && orderDetails ) {
    const wcOrder = orderDetails.wooCommerce;
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-12 text-center max-w-2xl mx-auto">
            <CheckCircle className="h-24 w-24 mx-auto mb-6 text-green-600" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Order Placed!</h2>
            <p className="text-gray-600 mb-8">
              Thank you for your order. A confirmation email will be sent to{' '}
              <strong>{ formData.email }</strong>.
            </p>

            { wcOrder && (
              <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left space-y-2">
                <h3 className="font-bold text-gray-900 mb-3">Order Summary</h3>
                <p className="text-sm text-gray-700">
                  WooCommerce Order:&nbsp;
                  <span className="font-semibold">
                    #{ wcOrder.order_id }
                  </span>
                </p>
                { wcOrder.status && (
                  <p className="text-sm text-gray-700">
                    Status:&nbsp;
                    <span className="font-semibold capitalize">{ wcOrder.status }</span>
                  </p>
                ) }
                <p className="text-sm text-gray-700">
                  Total:&nbsp;
                  <span className="font-semibold">${ total.toFixed( 2 ) }</span>
                </p>
                { orderDetails.veeqo && (
                  <p className="text-sm text-gray-700">
                    Fulfilment Order:&nbsp;
                    <span className="font-semibold">#{ orderDetails.veeqo.id }</span>
                  </p>
                ) }
              </div>
            ) }

            <div className="flex gap-4 justify-center flex-wrap">
              { wcOrder?.order_id && (
                <Link
                  to={ `/order/${ wcOrder.order_id }` }
                  className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                >
                  View Order Status
                </Link>
              ) }
              <button
                onClick={ () => navigate( '/products' ) }
                className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 px-6 py-3 rounded-lg font-semibold transition-all"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Checkout form ────────────────────────────────────────────────────────────
  const inputClass = ( field ) =>
    `w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
      errors[field] ? 'border-red-500' : 'border-gray-300'
    }`;

  return (
    <div className="min-h-screen bg-gray-50 py-8 page-wrapper">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Checkout</h1>
          <p className="text-gray-600">Complete your order</p>
        </div>

        <form onSubmit={ handleSubmit }>
          <div className="grid lg:grid-cols-3 gap-8">
            {/* ── Left column — forms ─────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-6">

              {/* Customer Information */}
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Customer Information</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  { [
                    { name: 'firstName', label: 'First Name', type: 'text'  },
                    { name: 'lastName',  label: 'Last Name',  type: 'text'  },
                    { name: 'email',     label: 'Email',      type: 'email' },
                    { name: 'phone',     label: 'Phone',      type: 'tel'   },
                  ].map( ( { name, label, type } ) => (
                    <div key={ name }>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        { label } <span className="text-red-500">*</span>
                      </label>
                      <input
                        type={ type }
                        name={ name }
                        value={ formData[name] }
                        onChange={ handleInputChange }
                        className={ inputClass( name ) }
                        autoComplete={ name === 'email' ? 'email' : undefined }
                      />
                      { errors[name] && (
                        <p className="text-red-600 text-xs mt-1">{ errors[name] }</p>
                      ) }
                    </div>
                  ) ) }
                </div>
              </div>

              {/* Shipping Address */}
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Truck size={ 20 } />
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
                      value={ formData.address }
                      onChange={ handleInputChange }
                      className={ inputClass( 'address' ) }
                      autoComplete="street-address"
                    />
                    { errors.address && (
                      <p className="text-red-600 text-xs mt-1">{ errors.address }</p>
                    ) }
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    { [
                      { name: 'city',  label: 'City'     },
                      { name: 'state', label: 'State'    },
                      { name: 'zip',   label: 'ZIP Code' },
                    ].map( ( { name, label } ) => (
                      <div key={ name }>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          { label } <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name={ name }
                          value={ formData[name] }
                          onChange={ handleInputChange }
                          className={ inputClass( name ) }
                        />
                        { errors[name] && (
                          <p className="text-red-600 text-xs mt-1">{ errors[name] }</p>
                        ) }
                      </div>
                    ) ) }
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <CreditCard size={ 20 } />
                  Payment Method
                </h2>

                <div className="space-y-3 mb-4">
                  { PAYMENT_METHODS.map( ( { id, label } ) => (
                    <label key={ id } className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={ id }
                        checked={ formData.paymentMethod === id }
                        onChange={ handleInputChange }
                        className="h-4 w-4 text-primary-600"
                      />
                      <span className="text-sm font-medium text-gray-800">{ label }</span>
                    </label>
                  ) ) }
                </div>

                <p className="text-xs text-gray-500 bg-gray-50 rounded p-3">
                  <strong>Note:</strong> Credit card / PayPal processing requires the
                  corresponding payment gateway to be configured in{' '}
                  <em>WP Admin → WooCommerce → Settings → Payments</em>.
                </p>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mt-4 mb-2">
                    Order Note (optional)
                  </label>
                  <textarea
                    name="customerNote"
                    value={ formData.customerNote }
                    onChange={ handleInputChange }
                    rows={ 2 }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                    placeholder="Special instructions for your order…"
                  />
                </div>

                <div className="flex items-center gap-2 mt-4 text-sm text-gray-600">
                  <Lock size={ 16 } />
                  <span>Secure SSL encrypted checkout</span>
                </div>
              </div>

              {/* Checkout error */}
              { checkoutError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{ checkoutError }</p>
                  </div>
                </div>
              ) }
            </div>

            {/* ── Right column — order summary + submit ───────────────────── */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-6 sticky top-24 border border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Order Summary</h2>

                <div className="space-y-3 mb-6">
                  { cartItems.map( ( item ) => (
                    <div key={ item.id } className="flex justify-between text-sm">
                      <div className="grow">
                        <p className="font-semibold text-gray-900">{ item.name }</p>
                        <p className="text-gray-500">Qty: { item.quantity }</p>
                      </div>
                      <p className="font-semibold text-gray-900 shrink-0">
                        ${ ( item.price * item.quantity ).toFixed( 2 ) }
                      </p>
                    </div>
                  ) ) }
                </div>

                <div className="border-t border-gray-200 pt-4 space-y-3 mb-6">
                  <div className="flex justify-between text-gray-700">
                    <span>Subtotal:</span>
                    <span className="font-semibold">${ subtotal.toFixed( 2 ) }</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Shipping:</span>
                    <span className="font-semibold">
                      { shipping === 0
                        ? <span className="text-green-600">FREE</span>
                        : `$${ shipping.toFixed( 2 ) }` }
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Tax (8%):</span>
                    <span className="font-semibold">${ tax.toFixed( 2 ) }</span>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold text-gray-900">Total:</span>
                    <span className="text-2xl font-bold text-primary-600">
                      ${ total.toFixed( 2 ) }
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={ processing }
                  className="w-full inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-4 rounded-lg font-semibold text-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  { processing ? (
                    <>
                      <Loader className="animate-spin" size={ 20 } />
                      { step === 'syncing' ? 'Syncing cart…' : 'Placing order…' }
                    </>
                  ) : (
                    <>
                      <Lock size={ 20 } />
                      Place Order
                    </>
                  ) }
                </button>

                <p className="text-xs text-gray-500 text-center mt-4">
                  By placing your order you agree to our terms and conditions.
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
