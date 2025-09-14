import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Orders.css";

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      const storedIsLoggedIn = localStorage.getItem("isLoggedIn");

      if (storedUser && storedIsLoggedIn === "true") {
        const parsedUser = JSON.parse(storedUser);
        setCurrentUser(parsedUser);

        // Load orders
        const userOrders = JSON.parse(
          localStorage.getItem(`orders_${parsedUser.email}`) || "[]"
        );
        setOrders(userOrders);

        // Load theme
        const userDarkMode = localStorage.getItem(`darkMode_${parsedUser.email}`);
        if (userDarkMode !== null) {
          setDarkMode(JSON.parse(userDarkMode));
        }
      } else {
        alert("Please log in to view your orders.");
        navigate("/");
      }
    } catch (err) {
      console.error("Error loading orders:", err);
      alert("Error loading orders, please login again.");
      navigate("/");
    }
  }, [navigate]);

  return (
    <div className={`orders-page ${darkMode ? "dark" : "light"}`}>
      <div className="orders-header">
        <h1>Your Orders</h1>
        <button
          onClick={() => navigate("/ProductPage")}
          className="continue-shopping-btn"
        >
          Continue Shopping
        </button>
      </div>

      {orders.length === 0 ? (
        <p>You have no orders yet.</p>
      ) : (
        <div className="orders-list">
          {orders.map((order) => (
            <div className="order-card" key={order.id}>
              <div className="order-info">
                <p><strong>Order ID:</strong> {order.id}</p>
                <p><strong>Date:</strong> {order.date}</p>
                <p><strong>Status:</strong> {order.status}</p>
              </div>

              <div className="order-items">
                {order.items.map((item) => (
                  <div className="order-item" key={item._id}>
                    <img
                      src={item.imageURL || "https://via.placeholder.com/80"}
                      alt={item.name}
                      className="order-item-img"
                    />
                    <div className="order-item-info">
                      <h3>{item.name}</h3>
                      <p>
                        Qty: {item.quantity || 1} | R{" "}
                        {((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="order-footer">
                <p><strong>Payment:</strong> {order.paymentMethod}</p>
                <p><strong>Total:</strong> R {order.total.toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Orders;
