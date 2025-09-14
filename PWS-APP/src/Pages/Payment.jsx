import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Payment.css";

const Payment = () => {
  const navigate = useNavigate();
  const [paymentMethod, setPaymentMethod] = useState("credit-card");
  const [cardData, setCardData] = useState({
    number: "",
    name: "",
    expiry: "",
    cvc: "",
  });
  const [paypalEmail, setPaypalEmail] = useState("");
  const [googlePayEmail, setGooglePayEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  // Disable body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  // Load current user and their cart
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    const storedIsLoggedIn = localStorage.getItem("isLoggedIn");

    if (!storedUser.email || storedIsLoggedIn !== "true") {
      navigate("/");
      return;
    }

    setCurrentUser(storedUser);
    const userCart = JSON.parse(
      localStorage.getItem(`cart_${storedUser.email}`) || "[]"
    );
    setCart(userCart);
  }, [navigate]);

  const totalPrice = cart.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
    0
  );

  const removeFromCart = (productId) => {
    const updatedCart = cart.filter((item) => item._id !== productId);
    setCart(updatedCart);
    if (currentUser?.email) {
      localStorage.setItem(
        `cart_${currentUser.email}`,
        JSON.stringify(updatedCart)
      );
    }
  };

  const isValidCard = (num) => {
    const value = num.replace(/\s/g, "");
    let sum = 0;
    let shouldDouble = false;
    for (let i = value.length - 1; i >= 0; i--) {
      let digit = parseInt(value.charAt(i));
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  };

  const formatCardNumber = (num) =>
    num.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");

  const handleCardChange = (e) => {
    const { name, value } = e.target;
    setCardData((prev) => ({
      ...prev,
      [name]: name === "number" ? formatCardNumber(value) : value,
    }));
  };

  const handlePlaceOrder = () => {
    if (cart.length === 0) return alert("Your cart is empty!");

    // ✅ Validate payment details
    if (paymentMethod === "credit-card") {
      const { number, name, expiry, cvc } = cardData;
      if (!number || !name || !expiry || !cvc)
        return alert("Fill all card details!");
      if (!/^\d{2}\/\d{2}$/.test(expiry))
        return alert("Invalid expiration date. Use MM/YY format.");
      if (!/^\d{3,4}$/.test(cvc)) return alert("Invalid CVC");
      if (!isValidCard(number)) return alert("Invalid card number");
    } else if (paymentMethod === "paypal") {
      if (!paypalEmail) return alert("Enter PayPal email!");
    } else if (paymentMethod === "google-pay") {
      if (!googlePayEmail) return alert("Enter Google Pay email!");
    }

    setLoading(true);

    setTimeout(() => {
      // ✅ Build new order object
      const newOrder = {
        id: "ORD-" + Date.now(),
        date: new Date().toLocaleDateString(),
        status: "Processing",
        items: cart,
        total: totalPrice,
        paymentMethod,
      };

      // ✅ Save to user-specific orders
      let userOrders = JSON.parse(
        localStorage.getItem(`orders_${currentUser.email}`) || "[]"
      );
      userOrders.push(newOrder);
      localStorage.setItem(
        `orders_${currentUser.email}`,
        JSON.stringify(userOrders)
      );

      // ✅ Clear cart
      localStorage.setItem(`cart_${currentUser.email}`, JSON.stringify([]));
      setCart([]);

      setLoading(false);
      alert("Payment successful! Order placed.");
      navigate("/Orders"); // redirect to Orders page
    }, 1500);
  };

  return (
    <div className="payment-fullscreen">
      <div className="payment-wrapper">
        <h2>Checkout Payment</h2>

        <div className="payment-container">
          {/* Order Summary */}
          <div className="order-summary">
            <h3>Order Summary</h3>
            {cart.length === 0 ? (
              <p>Your cart is empty.</p>
            ) : (
              <div className="cart-items">
                {cart.map((item) => (
                  <div className="cart-item-row" key={item._id}>
                    <img
                      src={item.imageURL || "https://via.placeholder.com/60"}
                      alt={item.name}
                      className="cart-item-img"
                    />
                    <div className="cart-item-info">
                      <p>{item.name}</p>
                      <p>
                        Qty: {item.quantity || 1} | R{" "}
                        {((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                      </p>
                    </div>
                    <button
                      className="remove-btn"
                      onClick={() => removeFromCart(item._id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="total">Total: R {totalPrice.toFixed(2)}</p>
          </div>

          {/* Payment Section */}
          <div className="payment-section">
            <div className="payment-methods">
              <label>
                <input
                  type="radio"
                  value="credit-card"
                  checked={paymentMethod === "credit-card"}
                  onChange={() => setPaymentMethod("credit-card")}
                />
                Credit Card
              </label>
              <label>
                <input
                  type="radio"
                  value="paypal"
                  checked={paymentMethod === "paypal"}
                  onChange={() => setPaymentMethod("paypal")}
                />
                PayPal
              </label>
              <label>
                <input
                  type="radio"
                  value="google-pay"
                  checked={paymentMethod === "google-pay"}
                  onChange={() => setPaymentMethod("google-pay")}
                />
                Google Pay
              </label>
            </div>

            {paymentMethod === "credit-card" && (
              <div className="card-form">
                <div className="card-preview">
                  <div className="card-number">
                    {cardData.number || "#### #### #### ####"}
                  </div>
                  <div className="card-details">
                    <span>{cardData.name || "CARDHOLDER NAME"}</span>
                    <span>{cardData.expiry || "MM/YY"}</span>
                  </div>
                </div>

                <input
                  type="text"
                  name="number"
                  placeholder="Card Number"
                  value={cardData.number}
                  onChange={handleCardChange}
                  maxLength={19}
                />
                <input
                  type="text"
                  name="name"
                  placeholder="Cardholder Name"
                  value={cardData.name}
                  onChange={handleCardChange}
                />
                <div className="card-row">
                  <input
                    type="text"
                    name="expiry"
                    placeholder="MM/YY"
                    value={cardData.expiry}
                    onChange={handleCardChange}
                    maxLength={5}
                  />
                  <input
                    type="text"
                    name="cvc"
                    placeholder="CVC"
                    value={cardData.cvc}
                    onChange={handleCardChange}
                    maxLength={4}
                  />
                </div>
              </div>
            )}

            {paymentMethod === "paypal" && (
              <div className="paypal-form">
                <input
                  type="email"
                  placeholder="PayPal Email"
                  value={paypalEmail}
                  onChange={(e) => setPaypalEmail(e.target.value)}
                />
              </div>
            )}

            {paymentMethod === "google-pay" && (
              <div className="google-pay-form">
                <input
                  type="email"
                  placeholder="Google Pay Email"
                  value={googlePayEmail}
                  onChange={(e) => setGooglePayEmail(e.target.value)}
                />
              </div>
            )}

            <button
              className="place-order-btn"
              onClick={handlePlaceOrder}
              disabled={loading}
            >
              {loading ? "Processing..." : "Place Order"}
            </button>

            <button
              className="back-to-cart-btn"
              onClick={() => navigate("/Cart")}
            >
              Back to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment;
