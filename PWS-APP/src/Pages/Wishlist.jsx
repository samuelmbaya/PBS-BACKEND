import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Wishlist.css";

const Wishlist = () => {
  const [wishlist, setWishlist] = useState([]);
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

        // Load wishlist
        const userWishlist = JSON.parse(
          localStorage.getItem(`wishlist_${parsedUser.email}`) || "[]"
        );
        setWishlist(userWishlist);

        // Load theme
        const userDarkMode = localStorage.getItem(`darkMode_${parsedUser.email}`);
        if (userDarkMode !== null) {
          setDarkMode(JSON.parse(userDarkMode));
        }
      } else {
        alert("Please log in to view your wishlist.");
        navigate("/");
      }
    } catch (err) {
      console.error("Error loading wishlist:", err);
      alert("Error loading wishlist, please login again.");
      navigate("/");
    }
  }, [navigate]);

  // Save wishlist when it changes
  useEffect(() => {
    if (currentUser && currentUser.email) {
      localStorage.setItem(`wishlist_${currentUser.email}`, JSON.stringify(wishlist));
    }
  }, [wishlist, currentUser]);

  // Remove from wishlist
  const removeFromWishlist = (id) => {
    setWishlist((prevWishlist) => prevWishlist.filter((item) => item._id !== id));
  };

  // Handle continue shopping
  const handleContinueShopping = () => {
    navigate("/ProductPage");
  };

  return (
    <div className={`wishlist-page ${darkMode ? "dark" : "light"}`}>
      <div className="wishlist-header">
        <h1>Your Wishlist</h1>
        <button onClick={handleContinueShopping} className="continue-shopping-btn">
          Continue Shopping
        </button>
      </div>

      {wishlist.length === 0 ? (
        <p>Your wishlist is empty.</p>
      ) : (
        <>
          <div className="wishlist-items">
            {wishlist.map((item) => (
              <div className="wishlist-item" key={item._id}>
                <img
                  src={item.imageURL || "https://via.placeholder.com/100"}
                  alt={item.name}
                  className="wishlist-item-img"
                />

                <div className="wishlist-item-info">
                  <h3>{item.name}</h3>
                  <p>R {item.price ? item.price.toLocaleString() : "0.00"}</p>
                </div>

                <button
                  onClick={() => removeFromWishlist(item._id)}
                  className="remove-btn"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Wishlist;